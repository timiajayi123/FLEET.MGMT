'use client';

import {
  CheckCircle2,
  ClipboardList,
  Filter,
  LoaderCircle,
  RotateCcw,
  Search,
  Wrench,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from './page-header';

type Vehicle = {
  id: string;
  registrationNumber: string;
  manufacturer: string;
  model: string;
  status: string;
  vehicleType?: { name: string } | null;
};
type MaintenanceRequest = {
  id: string;
  issueType: string;
  issueDescription: string;
  issueOccurredAt: string;
  status: string;
  evidenceMimeType?: string | null;
  serviceability?: string | null;
  adminRemark?: string | null;
  reviewedAt?: string | null;
  vehicle: Vehicle;
  reportedBy: { staffName: string; employeeId: string };
  reviewedBy?: { staffName: string } | null;
  createdAt: string;
};

export function MaintenanceWorkspace() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const [requestResponse, vehicleResponse] = await Promise.all([
        fetch('/api/maintenance', { cache: 'no-store' }),
        fetch('/api/maintenance/vehicles', { cache: 'no-store' }),
      ]);
      const requestPayload = await requestResponse.json().catch(() => ({}));
      const vehiclePayload = await vehicleResponse.json().catch(() => ({}));
      if (!requestResponse.ok)
        throw new Error(requestPayload.message || 'Unable to load maintenance requests.');
      setRequests(requestPayload.data ?? []);
      setCanReview(Boolean(requestPayload.canReview));
      if (vehicleResponse.ok) {
        setVehicles(vehiclePayload.data ?? []);
      } else {
        setVehicles([]);
        setError(
          vehiclePayload.message ||
            'Your maintenance form is available, but no eligible vehicles could be loaded. Make sure your user account is linked to a driver profile and has an allocated vehicle.',
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load maintenance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const pending = useMemo(
    () => requests.filter((request) => request.status === 'PENDING_REVIEW'),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const occurred = request.issueOccurredAt.slice(0, 10);
      if (fromDate && occurred < fromDate) return false;
      if (toDate && occurred > toDate) return false;
      if (driverFilter && request.reportedBy.employeeId !== driverFilter) return false;
      if (vehicleFilter && request.vehicle.id !== vehicleFilter) return false;
      if (issueFilter && request.issueType !== issueFilter) return false;
      if (statusFilter && request.status !== statusFilter) return false;
      if (serviceFilter && request.serviceability !== serviceFilter) return false;
      return (
        !term ||
        [
          request.vehicle.registrationNumber,
          request.vehicle.manufacturer,
          request.vehicle.model,
          request.reportedBy.staffName,
          request.reportedBy.employeeId,
          request.issueType,
          request.issueDescription,
        ].some((value) => value.toLowerCase().includes(term))
      );
    });
  }, [
    driverFilter,
    fromDate,
    issueFilter,
    requests,
    search,
    serviceFilter,
    statusFilter,
    toDate,
    vehicleFilter,
  ]);

  function clearFilters() {
    setSearch('');
    setFromDate('');
    setToDate('');
    setDriverFilter('');
    setVehicleFilter('');
    setIssueFilter('');
    setStatusFilter('');
    setServiceFilter('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch('/api/maintenance', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to submit maintenance request.');
      form.reset();
      setMessage('Maintenance request submitted for fleet review.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit maintenance request.');
    } finally {
      setSaving(false);
    }
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/maintenance/${selected.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to review maintenance request.');
      setSelected(null);
      setMessage('Vehicle maintenance decision saved.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to review maintenance request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Vehicle Maintenance"
        description={
          canReview === true
            ? 'Review driver-submitted vehicle fault reports and record the fleet maintenance decision.'
            : 'Report a fault for a vehicle allocated to you. Fleet administrators will review it.'
        }
      />
      {loading ? (
        <section className="maintenance-loading" aria-live="polite">
          <LoaderCircle size={30} />
          <div>
            <strong>Loading maintenance workspace</strong>
            <p>Retrieving requests, vehicle details and maintenance decisions…</p>
          </div>
        </section>
      ) : (
        <>
          <section className="maintenance-layout">
            {canReview === false && (
              <article className="panel maintenance-form-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Report a vehicle issue</h2>
                    <p>Select the vehicle, fault type, date and a clear description.</p>
                  </div>
                  <Wrench size={20} />
                </div>
                <form className="maintenance-form" onSubmit={submit}>
                  <label>
                    <span>Vehicle</span>
                    <select name="vehicleId" required defaultValue="">
                      <option value="" disabled>
                        Select vehicle
                      </option>
                      {vehicles.map((vehicle) => (
                        <option value={vehicle.id} key={vehicle.id}>
                          {vehicle.registrationNumber} - {vehicle.manufacturer} {vehicle.model}
                          {vehicle.vehicleType?.name ? ` (${vehicle.vehicleType.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Issue type</span>
                    <select name="issueType" required defaultValue="">
                      <option value="" disabled>
                        Select issue type
                      </option>
                      <option>Mechanical</option>
                      <option>Electrical</option>
                      <option>Tyres / wheels</option>
                      <option>Body / interior</option>
                      <option>Safety equipment</option>
                      <option>Fluid leak</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    <span>Date issue occurred</span>
                    <input
                      name="issueOccurredAt"
                      type="date"
                      required
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label className="full">
                    <span>Fault description</span>
                    <textarea
                      name="issueDescription"
                      required
                      rows={5}
                      maxLength={2000}
                      placeholder="Describe the fault, symptoms, and whether it affects safe use of the vehicle."
                    />
                  </label>
                  <label className="full">
                    <span>Fault photo (optional)</span>
                    <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" />
                    <small>JPEG, PNG, or WebP up to 5 MB.</small>
                  </label>
                  <button className="primary-action" disabled={saving || !vehicles.length}>
                    {saving ? 'Submitting...' : 'Submit maintenance request'}
                  </button>
                  {!vehicles.length && (
                    <small className="maintenance-note">
                      Drivers can report vehicles that have been allocated to them.
                    </small>
                  )}
                </form>
              </article>
            )}
            <article className="panel maintenance-summary">
              <div className="panel-heading">
                <div>
                  <h2>
                    {canReview === true ? 'Fleet maintenance review' : 'My maintenance requests'}
                  </h2>
                  <p>
                    {canReview === true
                      ? `${pending.length} request${pending.length === 1 ? '' : 's'} awaiting review.`
                      : 'Your submitted vehicle fault reports.'}
                  </p>
                </div>
                <ClipboardList size={20} />
              </div>
              {canReview === true && (
                <MaintenanceFilters
                  requests={requests}
                  search={search}
                  setSearch={setSearch}
                  fromDate={fromDate}
                  setFromDate={setFromDate}
                  toDate={toDate}
                  setToDate={setToDate}
                  driverFilter={driverFilter}
                  setDriverFilter={setDriverFilter}
                  vehicleFilter={vehicleFilter}
                  setVehicleFilter={setVehicleFilter}
                  issueFilter={issueFilter}
                  setIssueFilter={setIssueFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  serviceFilter={serviceFilter}
                  setServiceFilter={setServiceFilter}
                  resultCount={filteredRequests.length}
                  onClear={clearFilters}
                />
              )}
              {filteredRequests.length ? (
                <div className="maintenance-request-list">
                  {filteredRequests.map((request) => (
                    <article key={request.id}>
                      <header>
                        <strong>{request.issueType}</strong>
                        <span className={`maintenance-status ${request.status.toLowerCase()}`}>
                          {statusLabel(request.status)}
                        </span>
                      </header>
                      <dl className="maintenance-request-summary-grid">
                        <div>
                          <dt>Plate number</dt>
                          <dd>{request.vehicle.registrationNumber}</dd>
                        </div>
                        <div>
                          <dt>Vehicle type</dt>
                          <dd>{maintenanceVehicleType(request.vehicle)}</dd>
                        </div>
                        <div>
                          <dt>Occurred date</dt>
                          <dd>{new Date(request.issueOccurredAt).toLocaleDateString()}</dd>
                        </div>
                        <div>
                          <dt>Driver</dt>
                          <dd>{request.reportedBy.staffName}</dd>
                        </div>
                      </dl>
                      <div className="maintenance-feedback-preview">
                        <small>Driver feedback</small>
                        <p>{request.issueDescription}</p>
                      </div>
                      {canReview === true && (
                        <button className="secondary-action" onClick={() => setSelected(request)}>
                          {request.status === 'PENDING_REVIEW'
                            ? 'Open review request'
                            : 'View or change decision'}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="master-empty">
                  <Wrench size={28} />
                  <h2>
                    {canReview === null
                      ? 'Loading maintenance requests'
                      : canReview === true && requests.length
                        ? 'No matching maintenance requests'
                        : 'No maintenance requests'}
                  </h2>
                  <p>
                    {canReview === true && requests.length
                      ? 'Change or clear the filters to see other maintenance requests.'
                      : canReview === true
                        ? 'Driver-submitted fault reports will appear here for review.'
                        : 'Your submitted vehicle fault reports will appear here.'}
                  </p>
                </div>
              )}
            </article>
          </section>
        </>
      )}
      {message && (
        <div className="maintenance-toast">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}
      {error && <div className="master-alert">{error}</div>}
      {selected && (
        <div className="master-modal-backdrop">
          <section className="maintenance-review-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <small>MAINTENANCE REVIEW</small>
                <h2>{selected.vehicle.registrationNumber}</h2>
                <p>{maintenanceVehicleType(selected.vehicle)}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close review">
                <XCircle size={20} />
              </button>
            </header>
            <dl className="maintenance-review-details">
              <div>
                <dt>Occurred date</dt>
                <dd>{new Date(selected.issueOccurredAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>Driver</dt>
                <dd>{selected.reportedBy.staffName}</dd>
              </div>
              <div>
                <dt>Driver ID</dt>
                <dd>{selected.reportedBy.employeeId}</dd>
              </div>
              <div>
                <dt>Issue type</dt>
                <dd>{selected.issueType}</dd>
              </div>
              <div>
                <dt>Request status</dt>
                <dd>{statusLabel(selected.status)}</dd>
              </div>
              <div>
                <dt>Current decision</dt>
                <dd>
                  {selected.serviceability
                    ? selected.serviceability.replaceAll('_', ' ')
                    : 'Not decided'}
                </dd>
              </div>
            </dl>
            <section className="maintenance-review-feedback">
              <small>DRIVER FEEDBACK</small>
              <p>{selected.issueDescription}</p>
            </section>
            {selected.evidenceMimeType && (
              <a
                className="maintenance-evidence review-evidence"
                href={`/api/maintenance/${selected.id}/evidence`}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src={`/api/maintenance/${selected.id}/evidence`}
                  alt={`Fault evidence for ${selected.vehicle.registrationNumber}`}
                  width={256}
                  height={192}
                  unoptimized
                />
                <span>Open full image</span>
              </a>
            )}
            <form onSubmit={review}>
              <label>
                <span>Serviceability decision</span>
                <select
                  name="serviceability"
                  defaultValue={selected.serviceability ?? 'SERVICEABLE'}
                  required
                >
                  <option value="SERVICEABLE">Serviceable - send for maintenance</option>
                  <option value="UNSERVICEABLE">Unserviceable - remove from service</option>
                </select>
              </label>
              <label>
                <span>Fleet admin remark</span>
                <textarea
                  name="adminRemark"
                  rows={5}
                  required
                  maxLength={2000}
                  placeholder="Record the assessment, work required, workshop instruction, or reason for removing the vehicle from service."
                  defaultValue={selected.adminRemark ?? ''}
                />
              </label>
              <footer>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
                <button className="primary-action" disabled={saving}>
                  {saving
                    ? 'Saving...'
                    : selected.status === 'PENDING_REVIEW'
                      ? 'Save maintenance decision'
                      : 'Update maintenance decision'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

type FilterProps = {
  requests: MaintenanceRequest[];
  search: string;
  setSearch: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  driverFilter: string;
  setDriverFilter: (value: string) => void;
  vehicleFilter: string;
  setVehicleFilter: (value: string) => void;
  issueFilter: string;
  setIssueFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  serviceFilter: string;
  setServiceFilter: (value: string) => void;
  resultCount: number;
  onClear: () => void;
};

function MaintenanceFilters(props: FilterProps) {
  const drivers = [
    ...new Map(
      props.requests.map((request) => [request.reportedBy.employeeId, request.reportedBy]),
    ).values(),
  ].sort((a, b) => a.staffName.localeCompare(b.staffName));
  const vehicles = [
    ...new Map(props.requests.map((request) => [request.vehicle.id, request.vehicle])).values(),
  ].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
  const issues = [...new Set(props.requests.map((request) => request.issueType))].sort();
  return (
    <section className="maintenance-filters">
      <header>
        <div>
          <Filter size={17} />
          <span>
            <strong>Filter maintenance requests</strong>
            <small>
              {props.resultCount} matching record{props.resultCount === 1 ? '' : 's'}
            </small>
          </span>
        </div>
        <button type="button" onClick={props.onClear}>
          <RotateCcw size={14} /> Clear filters
        </button>
      </header>
      <div>
        <label className="maintenance-filter-search">
          <span>Search</span>
          <div>
            <Search size={15} />
            <input
              value={props.search}
              onChange={(event) => props.setSearch(event.target.value)}
              placeholder="Vehicle, driver, issue or description"
            />
          </div>
        </label>
        <label>
          <span>From date</span>
          <input
            type="date"
            value={props.fromDate}
            onChange={(event) => props.setFromDate(event.target.value)}
          />
        </label>
        <label>
          <span>To date</span>
          <input
            type="date"
            value={props.toDate}
            onChange={(event) => props.setToDate(event.target.value)}
          />
        </label>
        <label>
          <span>Driver</span>
          <select
            value={props.driverFilter}
            onChange={(event) => props.setDriverFilter(event.target.value)}
          >
            <option value="">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.employeeId} value={driver.employeeId}>
                {driver.staffName} - {driver.employeeId}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Vehicle</span>
          <select
            value={props.vehicleFilter}
            onChange={(event) => props.setVehicleFilter(event.target.value)}
          >
            <option value="">All vehicles</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber} -{' '}
                {vehicle.vehicleType?.name || `${vehicle.manufacturer} ${vehicle.model}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Issue type</span>
          <select
            value={props.issueFilter}
            onChange={(event) => props.setIssueFilter(event.target.value)}
          >
            <option value="">All issue types</option>
            {issues.map((issue) => (
              <option key={issue}>{issue}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={props.statusFilter}
            onChange={(event) => props.setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PENDING_REVIEW">Awaiting review</option>
            <option value="MAINTENANCE_REQUIRED">Maintenance required</option>
            <option value="OUT_OF_SERVICE">Out of service</option>
          </select>
        </label>
        <label>
          <span>Serviceability</span>
          <select
            value={props.serviceFilter}
            onChange={(event) => props.setServiceFilter(event.target.value)}
          >
            <option value="">All serviceability</option>
            <option value="SERVICEABLE">Serviceable</option>
            <option value="UNSERVICEABLE">Unserviceable</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function maintenanceVehicleType(vehicle: Vehicle) {
  const manufacturer = vehicle.manufacturer.trim();
  const selectedType = (
    vehicle.vehicleType?.name ||
    vehicle.model ||
    'Vehicle type not set'
  ).trim();
  return manufacturer && !selectedType.toLowerCase().startsWith(manufacturer.toLowerCase())
    ? `${manufacturer} ${selectedType}`
    : selectedType;
}

function statusLabel(status: string) {
  return (
    {
      PENDING_REVIEW: 'Awaiting fleet decision',
      MAINTENANCE_REQUIRED: 'Approved for maintenance',
      OUT_OF_SERVICE: 'Out of service',
    }[status] ?? status.replaceAll('_', ' ')
  );
}
