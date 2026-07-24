'use client';

import { PageHeader } from '@/components/page-header';
import { apiMessage, readApiJson } from '@/lib/api-response';
import { Eye, Search, XCircle } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Vehicle = { id: string; registrationNumber: string; manufacturer: string; model: string; status: string };
type Driver = { id: string; staffName: string; employeeId: string; status: string };
type VehicleRequest = {
  id: string;
  requestNumber: string;
  staffName: string;
  employeeId: string;
  location: string;
  directorate: string;
  department: string;
  unit: string;
  purposeOfTrip: string;
  vehicleTypeName: string;
  destination: string;
  departureDate: string;
  expectedReturnDate: string;
  numberOfPassengers: number;
  priority: string;
  remarks?: string | null;
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
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
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
      if (statusFilter && request.status !== statusFilter) return false;
      if (!search) return true;
      return [
        request.requestNumber,
        request.staffName,
        request.employeeId,
        request.location,
        request.directorate,
        request.department,
        request.unit,
        request.destination,
        request.purposeOfTrip,
        request.vehicleTypeName,
        request.priority,
        request.status,
      ].some((value) => String(value ?? '').toLowerCase().includes(search));
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
    await load();
  }

  async function approveWithAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!approvalRequest) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.startAt = new Date(String(body.startAt)).toISOString();
    body.expectedEndAt = new Date(String(body.expectedEndAt)).toISOString();
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, staff, destination or department" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="APPROVED">Approved</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Staff</th>
                <th>Destination</th>
                <th>Trip date</th>
                <th>Priority</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.requestNumber}</strong>
                    <small>{new Date(request.createdAt).toLocaleString()}</small>
                  </td>
                  <td>
                    <strong>{request.staffName}</strong>
                    <small>{request.employeeId}</small>
                  </td>
                  <td>
                    {request.destination}
                    <small>{request.department}</small>
                  </td>
                  <td>
                    {new Date(request.departureDate).toLocaleString()}
                    <small>to {new Date(request.expectedReturnDate).toLocaleString()}</small>
                  </td>
                  <td>{request.priority}</td>
                  <td>{request.status.replaceAll('_', ' ')}</td>
                  <td>
                    <div className="row-actions review-request-actions">
                      <button aria-label={`View ${request.requestNumber}`} onClick={() => setSelectedRequest(request)}>
                        <Eye size={15} />
                      </button>
                      {['PENDING_APPROVAL', 'REJECTED', 'APPROVED'].includes(request.status) && (
                        <>
                          <button className="secondary-action" onClick={() => void rejectRequest(request.id)}>
                            <XCircle size={15} /> Reject
                          </button>
                          <button className="primary-action" onClick={() => { setModalError(''); setApprovalRequest(request); }}>
                            Approve & allocate
                          </button>
                        </>
                      )}
                    </div>
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
      {selectedRequest && <RequestDetailsModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />}
      {approvalRequest && (
        <ApprovalAllocationModal
          request={approvalRequest}
          allocations={allocations.filter((allocation) => ['ASSIGNED', 'ACCEPTED'].includes(allocation.status) && (!allocation.request || allocation.request.id === approvalRequest.id))}
          vehicles={vehicles}
          drivers={drivers}
          onClose={() => { setModalError(''); setApprovalRequest(null); }}
          error={modalError}
          onClearError={() => setModalError('')}
          onSubmit={(event) => void approveWithAllocation(event)}
        />
      )}
    </>
  );
}

function RequestDetailsModal({ request, onClose }: { request: VehicleRequest; onClose: () => void }) {
  return (
    <div className="master-modal-backdrop">
      <section className="master-modal">
        <header>
          <div>
            <span>Request details</span>
            <h2>{request.requestNumber}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <div className="approval-request-summary">
          <strong>{request.staffName} ({request.employeeId})</strong>
          <small>{request.location} · {request.directorate} · {request.department} · {request.unit}</small>
          <small>{request.status.replaceAll('_', ' ')} · {request.priority}</small>
        </div>
        <div className="master-form-grid">
          <ReadOnly label="Purpose" value={request.purposeOfTrip} />
          <ReadOnly label="Vehicle type" value={request.vehicleTypeName} />
          <ReadOnly label="Destination" value={request.destination} />
          <ReadOnly label="Passengers" value={String(request.numberOfPassengers)} />
          <ReadOnly label="Departure" value={new Date(request.departureDate).toLocaleString()} />
          <ReadOnly label="Expected return" value={new Date(request.expectedReturnDate).toLocaleString()} />
          <ReadOnly label="Purpose details" value={request.remarks || 'No purpose details provided'} />
        </div>
        <footer>
          <button type="button" className="secondary-action" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
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
  const vehicleOptions = vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE' || vehicle.id === selectedAllocation?.vehicle.id);
  const driverOptions = drivers.filter((driver) => driver.status === 'AVAILABLE' || driver.id === selectedAllocation?.driver.id);

  return (
    <div className="master-modal-backdrop">
      <section className="master-modal">
        <header>
          <div>
            <span>Approve and allocate</span>
            <h2>{request.requestNumber}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="approval-request-summary">
            <strong>{request.staffName} ({request.employeeId})</strong>
            <small>{request.purposeOfTrip}</small>
            <small>{request.destination} · {new Date(request.departureDate).toLocaleString()} to {new Date(request.expectedReturnDate).toLocaleString()}</small>
          </div>
          {error && <div className="modal-alert error">{error}</div>}
          {selectedAllocation && (
            <div className="modal-alert info">
              Using existing allocation for {selectedAllocation.vehicle.registrationNumber} and {selectedAllocation.driver.staffName}. This prevents creating an overlapping active allocation.
            </div>
          )}
          <div className="master-form-grid">
            <Select
              name="allocationId"
              label="Use existing vehicle-driver allocation"
              placeholder="Create a new allocation in this approval"
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
            <Field name="startAt" label="Start date and time" type="datetime-local" value={toDatetimeLocal(selectedAllocation?.startAt || request.departureDate)} />
            <Field name="expectedEndAt" label="Expected return" type="datetime-local" value={toDatetimeLocal(selectedAllocation?.expectedEndAt || request.expectedReturnDate)} />
            <Field name="notes" label="Notes" required={false} value={selectedAllocation?.notes} />
          </div>
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
            <button className="primary-action" disabled={!vehicleOptions.length || !driverOptions.length}>
              Approve and allocate
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <input readOnly value={value} />
    </label>
  );
}

function Field({ name, label, type = 'text', required = true, value }: { name: string; label: string; type?: string; required?: boolean; value?: string }) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <input name={name} type={type} required={required} defaultValue={value ?? ''} />
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
        {...(onChange ? { value: value ?? '', onChange: (event) => onChange(event.target.value) } : { defaultValue: value ?? '' })}
      >
        <option value="" disabled={required}>{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function toDatetimeLocal(value?: string) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}
