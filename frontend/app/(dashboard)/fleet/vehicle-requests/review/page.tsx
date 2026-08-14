'use client';

import { PageHeader } from '@/components/page-header';
import { apiMessage, readApiJson } from '@/lib/api-response';
import { Eye, Search, XCircle } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Vehicle = {
  id: string;
  registrationNumber: string;
  manufacturer: string;
  model: string;
  status: string;
};
type Driver = { id: string; staffName: string; employeeId: string; status: string };
type VehicleRequest = {
  id: string;
  requestNumber: string;
  staffName: string;
  employeeId: string;
  location: string;
  directorate: string;
  department: string;
  unit?: string;
  purposeOfTrip: string;
  vehicleTypeName: string;
  destination: string;
  departureDate: string;
  expectedReturnDate: string;
  numberOfPassengers: number;
  priority: string;
  remarks?: string | null;
  attachmentFileName?: string | null;
  status: string;
  createdAt: string;
};
type Allocation = {
  id: string;
  purpose: string;
  destination?: string;
  startAt: string;
  expectedEndAt: string;
  notes?: string;
  status: string;
  request?: VehicleRequest;
  vehicle: Vehicle;
  driver: Driver;
};

export default function ReviewRequestsPage() {
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VehicleRequest | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<VehicleRequest | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    const [requestPayload, allocationPayload, vehiclePayload, driverPayload] = await Promise.all([
      fetch('/api/vehicle-requests').then((r) => readApiJson<{ data?: VehicleRequest[] }>(r)),
      fetch('/api/vehicle-allocations').then((r) => readApiJson<{ data?: Allocation[] }>(r)),
      fetch('/api/vehicles').then((r) => readApiJson<{ data?: Vehicle[] }>(r)),
      fetch('/api/drivers').then((r) => readApiJson<{ data?: Driver[] }>(r)),
    ]);
    setRequests(requestPayload.data || []);
    setAllocations(allocationPayload.data || []);
    setVehicles(vehiclePayload.data || []);
    setDrivers(driverPayload.data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredRequests = useMemo(() => {
    const search = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'APPROVED_ALLOCATED'
          ? ['APPROVED', 'ALLOCATED'].includes(request.status)
          : request.status === statusFilter);
      if (!matchesStatus) return false;
      if (!search) return true;
      return [
        request.requestNumber,
        request.staffName,
        request.employeeId,
        request.location,
        request.directorate,
        request.department,
        request.destination,
        request.purposeOfTrip,
        request.vehicleTypeName,
        request.priority,
        request.status,
      ].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(search),
      );
    });
  }, [query, requests, statusFilter]);

  async function rejectRequest(id: string) {
    const action = 'reject';
    const response = await fetch(`/api/vehicle-requests/${id}/${action}`, { method: 'PATCH' });
    const payload = await readApiJson(response, `Unable to ${action} request.`);
    if (!response.ok) {
      setError(apiMessage(payload.message, `Unable to ${action} request.`));
      return;
    }
    setError('');
    setSelectedRequest(null);
    await load();
  }

  async function approveWithAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!approvalRequest) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.startAt = new Date(approvalRequest.departureDate).toISOString();
    body.expectedEndAt = new Date(approvalRequest.expectedReturnDate).toISOString();
    if (!body.allocationId) delete body.allocationId;
    const response = await fetch(`/api/vehicle-requests/${approvalRequest.id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await readApiJson(response, 'Unable to approve and allocate request.');
    if (!response.ok) {
      setModalError(apiMessage(payload.message, 'Unable to approve and allocate request.'));
      return;
    }
    setApprovalRequest(null);
    setModalError('');
    setError('');
    await load();
  }

  return (
    <>
      <PageHeader
        title="Review Requests"
        description="Review staff vehicle requests, inspect details, reject, or approve and allocate a vehicle-driver pair."
      />
      {error && <div className="master-alert">{error}</div>}
      <section className="master-panel">
        <div className="master-toolbar">
          <label>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search request, staff, destination or department"
            />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="APPROVED_ALLOCATED">Approved and allocated</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="master-table-wrap">
          <table className="master-table review-request-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Staff name</th>
                <th>Staff ID</th>
                <th>Destination</th>
                <th>Departure</th>
                <th>Priority</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.requestNumber}</strong>
                  </td>
                  <td>{request.staffName}</td>
                  <td>
                    <strong>{request.employeeId}</strong>
                  </td>
                  <td>{request.destination}</td>
                  <td className="date-cell">{new Date(request.departureDate).toLocaleString()}</td>
                  <td>{request.priority}</td>
                  <td>
                    <span className={`request-table-status ${request.status.toLowerCase()}`}>
                      {request.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="review-view-button"
                      aria-label={`View ${request.requestNumber}`}
                      onClick={() => setSelectedRequest(request)}
                    >
                      <Eye size={21} /> View request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRequests.length === 0 && (
          <div className="master-empty">
            <h2>No requests found</h2>
            <p>New staff vehicle requests will appear here for review.</p>
          </div>
        )}
      </section>
      {selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onReject={() => void rejectRequest(selectedRequest.id)}
          onApproveAndAllocate={() => {
            setModalError('');
            setApprovalRequest(selectedRequest);
            setSelectedRequest(null);
          }}
        />
      )}
      {approvalRequest && (
        <ApprovalAllocationModal
          request={approvalRequest}
          allocations={allocations.filter(
            (allocation) =>
              ['ASSIGNED', 'ACCEPTED'].includes(allocation.status) &&
              (!allocation.request || allocation.request.id === approvalRequest.id),
          )}
          vehicles={vehicles}
          drivers={drivers}
          onClose={() => {
            setModalError('');
            setApprovalRequest(null);
          }}
          error={modalError}
          onClearError={() => setModalError('')}
          onSubmit={(event) => void approveWithAllocation(event)}
        />
      )}
    </>
  );
}

function RequestDetailsModal({
  request,
  onClose,
  onReject,
  onApproveAndAllocate,
}: {
  request: VehicleRequest;
  onClose: () => void;
  onReject: () => void;
  onApproveAndAllocate: () => void;
}) {
  const canReject = request.status === 'PENDING_APPROVAL';
  const canAllocate = ['PENDING_APPROVAL', 'APPROVED'].includes(request.status);
  return (
    <div className="master-modal-backdrop">
      <section className="master-modal request-review-modal">
        <header>
          <div>
            <span>Request details</span>
            <h2>{request.requestNumber}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <div className="request-review-sections">
          <RequestReviewSection
            number="01"
            title="Staff details"
            description="Information about the staff member who submitted the request."
          >
            <RequestDetail label="Staff name" value={request.staffName} />
            <RequestDetail label="Employee ID" value={request.employeeId} />
            <RequestDetail label="Directorate" value={request.directorate} />
            <RequestDetail label="Department" value={request.department} />
            <RequestDetail label="Unit" value={request.unit || 'Not provided'} />
          </RequestReviewSection>

          <RequestReviewSection
            number="02"
            title="Trip details"
            description="Journey requirements submitted for approval and allocation."
          >
            <RequestDetail label="Destination from" value={request.location} />
            <RequestDetail label="Destination to" value={request.destination} />
            <RequestDetail label="Purpose of trip" value={request.purposeOfTrip} />
            <RequestDetail label="Vehicle type" value={request.vehicleTypeName} />
            <RequestDetail
              label="Departure"
              value={new Date(request.departureDate).toLocaleString()}
            />
            <RequestDetail
              label="Expected return"
              value={new Date(request.expectedReturnDate).toLocaleString()}
            />
            <RequestDetail
              label="Number of passengers"
              value={
                request.numberOfPassengers ? String(request.numberOfPassengers) : 'Not specified'
              }
            />
            <RequestDetail label="Priority" value={request.priority} />
            <RequestDetail
              label="Purpose details"
              value={request.remarks || 'No purpose details provided'}
              full
            />
          </RequestReviewSection>

          <RequestReviewSection
            number="03"
            title="Supporting information"
            description="Request reference and current approval status."
          >
            <RequestDetail label="Request ID" value={request.requestNumber} />
            <RequestDetail label="Status" value={request.status.replaceAll('_', ' ')} />
            <RequestDetail label="Submitted" value={new Date(request.createdAt).toLocaleString()} />
            <RequestDetail
              label="Supporting document"
              value={request.attachmentFileName || 'No document attached'}
            />
          </RequestReviewSection>
        </div>
        <footer className="request-details-actions">
          <button type="button" className="secondary-action" onClick={onClose}>
            Close
          </button>
          {(canReject || canAllocate) && (
            <div>
              {canReject && (
                <button type="button" className="request-reject-action" onClick={onReject}>
                  <XCircle size={16} />
                  <span>Reject request</span>
                </button>
              )}
              {canAllocate && (
                <button type="button" className="primary-action" onClick={onApproveAndAllocate}>
                  Approve and allocate
                </button>
              )}
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}

function RequestReviewSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="request-review-section">
      <div className="request-review-section-heading">
        <span>{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <dl className="details-grid request-details-grid">{children}</dl>
    </section>
  );
}

function ApprovalAllocationModal({
  request,
  allocations,
  vehicles,
  drivers,
  onClose,
  error,
  onClearError,
  onSubmit,
}: {
  request: VehicleRequest;
  allocations: Allocation[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onClose: () => void;
  error: string;
  onClearError: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [allocationId, setAllocationId] = useState('');
  const selectedAllocation = useMemo(
    () => allocations.find((allocation) => allocation.id === allocationId),
    [allocationId, allocations],
  );
  const vehicleOptions = vehicles.filter(
    (vehicle) => vehicle.status === 'AVAILABLE' || vehicle.id === selectedAllocation?.vehicle.id,
  );
  const driverOptions = drivers.filter(
    (driver) => driver.status === 'AVAILABLE' || driver.id === selectedAllocation?.driver.id,
  );

  return (
    <div className="master-modal-backdrop">
      <section className="master-modal approval-allocation-modal">
        <header>
          <div>
            <span>Approve and allocate</span>
            <h2>{request.requestNumber}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="approval-request-summary">
            <strong>
              {request.staffName} ({request.employeeId})
            </strong>
            <small>{request.purposeOfTrip}</small>
            <small>
              {request.destination} · {new Date(request.departureDate).toLocaleString()} to{' '}
              {new Date(request.expectedReturnDate).toLocaleString()}
            </small>
          </div>
          {error && <div className="modal-alert error">{error}</div>}
          {selectedAllocation && (
            <div className="modal-alert info">
              Using existing allocation for {selectedAllocation.vehicle.registrationNumber} and{' '}
              {selectedAllocation.driver.staffName}. This prevents creating an overlapping active
              allocation.
            </div>
          )}
          <div className="approval-allocation-sections">
            <section className="approval-allocation-section">
              <header>
                <span>01</span>
                <div>
                  <h3>Permanent allocation</h3>
                  <p>Select an existing permanent vehicle-driver allocation when available.</p>
                </div>
              </header>
              <div className="approval-single-row">
                <Select
                  name="allocationId"
                  label="Existing permanent allocation (Optional)"
                  placeholder="No permanent allocation — create a flexible allocation"
                  required={false}
                  value={allocationId}
                  onChange={(value) => {
                    onClearError();
                    setAllocationId(value);
                  }}
                  options={allocations.map((allocation) => ({
                    id: allocation.id,
                    label: `${allocation.vehicle.registrationNumber} - ${allocation.driver.staffName} - ${new Date(allocation.startAt).toLocaleString()} - ${allocation.id.slice(0, 8)}`,
                  }))}
                />
              </div>
            </section>

            <section className="approval-allocation-section">
              <header>
                <span>02</span>
                <div>
                  <h3>Flexible allocation</h3>
                  <p>Select the vehicle and driver for this request.</p>
                </div>
              </header>
              <div className="approval-pair-row">
                <Select
                  key={`vehicle-${selectedAllocation?.id ?? 'new'}`}
                  name="vehicleId"
                  label="Vehicle"
                  placeholder="Select available vehicle"
                  value={selectedAllocation?.vehicle.id}
                  options={vehicleOptions.map((vehicle) => ({
                    id: vehicle.id,
                    label: `${vehicle.registrationNumber} - ${vehicle.manufacturer} ${vehicle.model}`,
                  }))}
                />
                <Select
                  key={`driver-${selectedAllocation?.id ?? 'new'}`}
                  name="driverId"
                  label="Driver"
                  placeholder="Select available driver"
                  value={selectedAllocation?.driver.id}
                  options={driverOptions.map((driver) => ({
                    id: driver.id,
                    label: `${driver.staffName} (${driver.employeeId})`,
                  }))}
                />
              </div>
            </section>

            <section className="approval-allocation-section">
              <header>
                <span>03</span>
                <div>
                  <h3>Trip schedule</h3>
                  <p>The approved request dates are locked and cannot be changed here.</p>
                </div>
              </header>
              <div className="approval-pair-row">
                <Field
                  name="startAt"
                  label="Start date and time (locked)"
                  type="datetime-local"
                  value={toDatetimeLocal(request.departureDate)}
                  readOnly
                />
                <Field
                  name="expectedEndAt"
                  label="Expected return (locked)"
                  type="datetime-local"
                  value={toDatetimeLocal(request.expectedReturnDate)}
                  readOnly
                />
              </div>
              <div className="approval-notes-row">
                <Field
                  name="notes"
                  label="Notes (Optional)"
                  required={false}
                  value={selectedAllocation?.notes}
                />
              </div>
            </section>
          </div>
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-action"
              disabled={!vehicleOptions.length || !driverOptions.length}
            >
              Approve and allocate
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function RequestDetail({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? 'full' : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = true,
  value,
  readOnly = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={value ?? ''}
        readOnly={readOnly}
      />
    </label>
  );
}

function Select({
  name,
  label,
  placeholder,
  options,
  value,
  required = true,
  onChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  value?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <select
        name={name}
        required={required}
        {...(onChange
          ? { value: value ?? '', onChange: (event) => onChange(event.target.value) }
          : { defaultValue: value ?? '' })}
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toDatetimeLocal(value?: string) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}
