'use client';

import {
  CheckCircle2,
  ClipboardList,
  Filter,
  LoaderCircle,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  driverFeedback?: 'SATISFACTORY' | 'NOT_SATISFACTORY' | null;
  driverFeedbackRemark?: string | null;
  driverFeedbackAt?: string | null;
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
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);
  const [feedbackRequest, setFeedbackRequest] = useState<MaintenanceRequest | null>(null);
  const [feedbackChoice, setFeedbackChoice] = useState<
    'SATISFACTORY' | 'NOT_SATISFACTORY' | ''
  >('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [showAllReports, setShowAllReports] = useState(false);
  const [totalReports, setTotalReports] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const historyLoaded = useRef(false);

  const load = useCallback(async (showLoading = true, includeHistory = historyLoaded.current) => {
    if (showLoading) setLoading(true);
    try {
      if (showLoading) setError('');
      const limit = includeHistory ? 200 : 2;
      const requestResponse = await fetch(
        `/api/maintenance?limit=${limit}&refresh=${Date.now()}`,
        { cache: 'no-store' },
      );
      const requestPayload = await requestResponse.json().catch(() => ({}));
      if (!requestResponse.ok)
        throw new Error(requestPayload.message || 'Unable to load maintenance requests.');
      setRequests(requestPayload.data ?? []);
      setTotalReports(Number(requestPayload.total ?? requestPayload.data?.length ?? 0));
      setPendingTotal(Number(requestPayload.pendingTotal ?? 0));
      setCanReview(Boolean(requestPayload.canReview));
      return true;
    } catch (reason) {
      if (showLoading || includeHistory) {
        setError(reason instanceof Error ? reason.message : 'Unable to load maintenance.');
      }
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const refreshTimer = window.setInterval(refresh, 10_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  useEffect(() => {
    if (canReview !== false) return;
    const controller = new AbortController();
    setVehiclesLoading(true);
    fetch(`/api/maintenance/vehicles?refresh=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            payload.message ||
              'No eligible vehicles could be loaded. Make sure your account is linked to a driver profile and has an allocated vehicle.',
          );
        setVehicles(payload.data ?? []);
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      })
      .finally(() => setVehiclesLoading(false));
    return () => controller.abort();
  }, [canReview]);
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
  const visibleRequests = showAllReports ? filteredRequests : filteredRequests.slice(0, 2);

  async function revealHistory() {
    setShowAllReports(true);
    if (historyLoaded.current) return;
    setLoadingHistory(true);
    const loaded = await load(false, true);
    if (loaded) historyLoaded.current = true;
    setLoadingHistory(false);
  }

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
      if (payload.data) {
        setRequests((current) =>
          current.map((request) => (request.id === payload.data.id ? payload.data : request)),
        );
      }
      setSelected(null);
      setMessage('Vehicle maintenance decision saved.');
      await load(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to review maintenance request.');
    } finally {
      setSaving(false);
    }
  }

  function openFeedback(request: MaintenanceRequest) {
    if (request.driverFeedback) return;
    setFeedbackRequest(request);
    setFeedbackChoice('');
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackRequest || !feedbackChoice) return;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/maintenance/${feedbackRequest.id}/driver-feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackChoice, remark: form.get('remark') }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to save your feedback.');
      if (payload.data) {
        setRequests((current) =>
          current.map((request) => (request.id === payload.data.id ? payload.data : request)),
        );
      }
      setFeedbackRequest(null);
      setFeedbackChoice('');
      setMessage('Maintenance feedback sent.');
      await load(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your feedback.');
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
                  <button className="primary-action" disabled={saving || vehiclesLoading || !vehicles.length}>
                    {saving
                      ? 'Submitting...'
                      : vehiclesLoading
                        ? 'Loading vehicles...'
                        : 'Submit maintenance request'}
                  </button>
                  {!vehiclesLoading && !vehicles.length && (
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
                      ? `${pendingTotal} request${pendingTotal === 1 ? '' : 's'} awaiting review.`
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
                  onExpand={() => void revealHistory()}
                />
              )}
              {filteredRequests.length ? (
                <>
                <div className="maintenance-request-list">
                  {visibleRequests.map((request) => (
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
                        <small>Reported issue</small>
                        <p>{request.issueDescription}</p>
                      </div>
                      {request.reviewedAt && (
                        <div className="maintenance-decision-preview">
                          <small>Fleet decision</small>
                          <strong>{statusLabel(request.status)}</strong>
                          {request.adminRemark && <p>{request.adminRemark}</p>}
                        </div>
                      )}
                      {request.driverFeedback && (
                        <div className={`maintenance-driver-response ${request.driverFeedback.toLowerCase()}`}>
                          <small>Driver response</small>
                          <strong>{feedbackLabel(request.driverFeedback)}</strong>
                          {request.driverFeedbackRemark && <p>{request.driverFeedbackRemark}</p>}
                        </div>
                      )}
                      {canReview === true && (
                        <button className="secondary-action" onClick={() => setSelected(request)}>
                          {request.status === 'PENDING_REVIEW'
                            ? 'Open review request'
                            : 'View decision'}
                        </button>
                      )}
                      {canReview === false && request.reviewedAt && !request.driverFeedback && (
                        <button className="secondary-action" onClick={() => openFeedback(request)}>
                          Give feedback
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                {totalReports > 2 && (
                  <button
                    type="button"
                    className="secondary-action maintenance-show-reports"
                    disabled={loadingHistory}
                    onClick={() => {
                      if (showAllReports) setShowAllReports(false);
                      else void revealHistory();
                    }}
                  >
                    {loadingHistory
                      ? 'Loading reports...'
                      : showAllReports
                      ? 'Show only recent reports'
                      : `Show all reports (${totalReports})`}
                  </button>
                )}
                </>
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
              <small>REPORTED ISSUE</small>
              <p>{selected.issueDescription}</p>
            </section>
            {selected.driverFeedback && (
              <section className="maintenance-review-driver-response">
                <small>DRIVER RESPONSE</small>
                <strong>{feedbackLabel(selected.driverFeedback)}</strong>
                {selected.driverFeedbackRemark && <p>{selected.driverFeedbackRemark}</p>}
              </section>
            )}
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
            {selected.status === 'PENDING_REVIEW' && !selected.reviewedAt ? (
              <form onSubmit={review}>
                <label>
                  <span>Serviceability decision</span>
                  <select name="serviceability" defaultValue="SERVICEABLE" required>
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
                    {saving ? 'Saving...' : 'Save maintenance decision'}
                  </button>
                </footer>
              </form>
            ) : (
              <section className="maintenance-final-notice">
                <CheckCircle2 size={19} />
                <div>
                  <strong>Decision completed</strong>
                  <p>This maintenance decision is final and cannot be changed.</p>
                </div>
                <button className="secondary-action" onClick={() => setSelected(null)}>
                  Close
                </button>
              </section>
            )}
          </section>
        </div>
      )}
      {feedbackRequest && (
        <div className="master-modal-backdrop">
          <section className="maintenance-feedback-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <small>MAINTENANCE DECISION</small>
                <h2>Was the decision satisfactory?</h2>
                <p>{feedbackRequest.vehicle.registrationNumber} · {statusLabel(feedbackRequest.status)}</p>
              </div>
              <button onClick={() => setFeedbackRequest(null)} aria-label="Close feedback">
                <XCircle size={20} />
              </button>
            </header>
            {feedbackRequest.adminRemark && (
              <div className="maintenance-feedback-decision">
                <small>Fleet remark</small>
                <p>{feedbackRequest.adminRemark}</p>
              </div>
            )}
            <form onSubmit={submitFeedback}>
              <fieldset>
                <legend>Your response</legend>
                <div className="maintenance-feedback-options">
                  <button
                    type="button"
                    className={feedbackChoice === 'SATISFACTORY' ? 'active' : ''}
                    onClick={() => setFeedbackChoice('SATISFACTORY')}
                  >
                    <ThumbsUp size={18} /> Satisfactory
                  </button>
                  <button
                    type="button"
                    className={feedbackChoice === 'NOT_SATISFACTORY' ? 'active negative' : ''}
                    onClick={() => setFeedbackChoice('NOT_SATISFACTORY')}
                  >
                    <ThumbsDown size={18} /> Not satisfactory
                  </button>
                </div>
              </fieldset>
              <label>
                <span>Remark (optional)</span>
                <textarea
                  name="remark"
                  rows={4}
                  maxLength={1000}
                  defaultValue={feedbackRequest.driverFeedbackRemark ?? ''}
                  placeholder="Add a short remark if needed"
                />
              </label>
              <footer>
                <button type="button" className="secondary-action" onClick={() => setFeedbackRequest(null)}>Cancel</button>
                <button className="primary-action" disabled={saving || !feedbackChoice}>
                  {saving ? 'Sending...' : 'Send feedback'}
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
  onExpand: () => void;
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
    <section className="maintenance-filters" onFocusCapture={props.onExpand}>
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

function feedbackLabel(feedback: 'SATISFACTORY' | 'NOT_SATISFACTORY') {
  return feedback === 'SATISFACTORY' ? 'Satisfactory' : 'Not satisfactory';
}
