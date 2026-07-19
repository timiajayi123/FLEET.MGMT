'use client';

import { PageHeader } from '@/components/page-header';
import { apiMessage, readApiJson } from '@/lib/api-response';
import { Pencil, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Vehicle = { id: string; registrationNumber: string; manufacturer: string; model: string; status: string };
type Driver = { id: string; staffName: string; employeeId: string; status: string };
type CurrentUser = { employeeId: string; role: { code: string; name: string } };
type VehicleRequest = { id: string; requestNumber: string; staffName: string; destination: string; status: string };
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
type Mode = { type: 'create'; allocation?: undefined } | { type: 'edit'; allocation: Allocation };

export default function AllocationPage() {
  const [items, setItems] = useState<Allocation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [mePayload, allocations, vehiclePayload, driverPayload, requestPayload] = await Promise.all([
      fetch('/api/auth/me').then((r) => (r.ok ? readApiJson<{ user?: CurrentUser }>(r) : null)),
      fetch('/api/vehicle-allocations').then((r) => readApiJson<{ data?: Allocation[] }>(r)),
      fetch('/api/vehicles').then((r) => readApiJson<{ data?: Vehicle[] }>(r)),
      fetch('/api/drivers').then((r) => readApiJson<{ data?: Driver[] }>(r)),
      fetch('/api/vehicle-requests').then((r) => readApiJson<{ data?: VehicleRequest[] }>(r)),
    ]);
    setCurrentUser(mePayload?.user ?? null);
    setItems(allocations.data || []);
    setVehicles(vehiclePayload.data || []);
    setDrivers(driverPayload.data || []);
    setRequests(requestPayload.data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.startAt = new Date(String(body.startAt)).toISOString();
    body.expectedEndAt = new Date(String(body.expectedEndAt)).toISOString();
    if (!body.requestId) delete body.requestId;
    const editing = mode?.type === 'edit';
    const response = await fetch(`/api/vehicle-allocations${editing ? `/${mode.allocation.id}` : ''}`, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await readApiJson(response, 'Unable to save allocation.');
    if (!response.ok) {
      setError(apiMessage(payload.message, 'Unable to save allocation.'));
      return;
    }
    setMode(null);
    setError('');
    await load();
  }

  async function complete(id: string) {
    await fetch(`/api/vehicle-allocations/${id}/complete`, { method: 'PATCH' });
    await load();
  }

  async function deleteAllocation(allocation: Allocation) {
    const confirmed = window.confirm(
      `Delete allocation for ${allocation.vehicle.registrationNumber} and ${allocation.driver.staffName}?`,
    );
    if (!confirmed) return;
    const response = await fetch(`/api/vehicle-allocations/${allocation.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Unable to delete allocation.');
      return;
    }
    setError('');
    await load();
  }

  const isDriver = currentUser?.role.code === 'DRIVER';
  const canManageAllocations = ['S_ADMIN', 'FM'].includes(currentUser?.role.code ?? '');
  const visibleItems = isDriver
    ? items.filter((allocation) => allocation.driver.employeeId === currentUser?.employeeId)
    : items;

  return (
    <>
      <PageHeader
        title={isDriver ? 'My Vehicle Allocations' : 'Vehicle Allocation'}
        description={
          isDriver
            ? 'View vehicles currently allocated to you for approved request-backed trips.'
            : 'View, create, edit, complete, and delete vehicle-driver allocations.'
        }
        actions={
          canManageAllocations ? (
            <button className="primary-action" onClick={() => setMode({ type: 'create' })}>
              New allocation
            </button>
          ) : null
        }
      />
      {error && <div className="master-alert">{error}</div>}
      <section className="master-panel">
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Request</th>
                <th>Purpose</th>
                <th>Period</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((allocation) => (
                <tr key={allocation.id}>
                  <td>
                    <strong>{allocation.vehicle.registrationNumber}</strong>
                    <small>{allocation.vehicle.manufacturer} {allocation.vehicle.model}</small>
                  </td>
                  <td>
                    <strong>{allocation.driver.staffName}</strong>
                    <small>{allocation.driver.employeeId}</small>
                  </td>
                  <td>
                    {allocation.request?.requestNumber ?? 'Direct allocation'}
                    <small>{allocation.request?.staffName ?? ''}</small>
                  </td>
                  <td>
                    {allocation.purpose}
                    <small>{allocation.destination || ''}</small>
                  </td>
                  <td>
                    {new Date(allocation.startAt).toLocaleString()}
                    <small>to {new Date(allocation.expectedEndAt).toLocaleString()}</small>
                  </td>
                  <td>{allocation.status.replaceAll('_', ' ')}</td>
                  <td>
                    <div className="row-actions">
                      {canManageAllocations && ['ASSIGNED', 'ACCEPTED'].includes(allocation.status) && (
                        <>
                          <button aria-label={`Edit allocation ${allocation.id}`} onClick={() => setMode({ type: 'edit', allocation })}>
                            <Pencil size={15} />
                          </button>
                          <button className="secondary-action" onClick={() => void complete(allocation.id)}>
                            Complete
                          </button>
                        </>
                      )}
                      {canManageAllocations && (
                        <button
                          aria-label={`Delete allocation ${allocation.id}`}
                          className="danger-action"
                          onClick={() => void deleteAllocation(allocation)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleItems.length === 0 && (
          <div className="master-empty">
            <h2>{isDriver ? 'No allocations assigned to you' : 'No allocations yet'}</h2>
            <p>
              {isDriver
                ? 'When fleet admin assigns a vehicle to your employee ID from an approved request, it will appear here.'
                : 'Create an allocation here, or approve a staff request from Review Requests.'}
            </p>
          </div>
        )}
      </section>
      {mode && canManageAllocations && (
        <AllocationModal
          mode={mode}
          vehicles={vehicles}
          drivers={drivers}
          requests={requests.filter((request) => ['APPROVED', 'ALLOCATED'].includes(request.status) || request.id === mode.allocation?.request?.id)}
          onClose={() => setMode(null)}
          onSubmit={(event) => void save(event)}
        />
      )}
    </>
  );
}

function AllocationModal({
  mode,
  vehicles,
  drivers,
  requests,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  vehicles: Vehicle[];
  drivers: Driver[];
  requests: VehicleRequest[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const allocation = mode.allocation;
  const vehicleOptions = vehicles.filter(
    (vehicle) => vehicle.status === 'AVAILABLE' || vehicle.id === allocation?.vehicle.id,
  );
  const driverOptions = drivers.filter(
    (driver) => driver.status === 'AVAILABLE' || driver.id === allocation?.driver.id,
  );
  return (
    <div className="master-modal-backdrop">
      <section className="master-modal">
        <header>
          <div>
            <span>{allocation ? 'Edit assignment' : 'New assignment'}</span>
            <h2>{allocation ? 'Edit allocation' : 'Allocate vehicle to driver'}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="master-form-grid">
            <Select
              name="requestId"
              label="Vehicle request (optional)"
              placeholder="No request - direct vehicle-driver allocation"
              required={false}
              value={allocation?.request?.id}
              options={requests.map((request) => ({ id: request.id, label: `${request.requestNumber} - ${request.staffName} - ${request.destination}` }))}
            />
            <Field name="purpose" label="Purpose" value={allocation?.purpose} />
            <Field name="destination" label="Destination" value={allocation?.destination} />
            <Select
              name="vehicleId"
              label="Vehicle"
              placeholder="Select available vehicle"
              value={allocation?.vehicle.id}
              options={vehicleOptions.map((vehicle) => ({
                id: vehicle.id,
                label: `${vehicle.registrationNumber} - ${vehicle.manufacturer} ${vehicle.model}`,
              }))}
            />
            <Select
              name="driverId"
              label="Driver"
              placeholder="Select available driver"
              value={allocation?.driver.id}
              options={driverOptions.map((driver) => ({
                id: driver.id,
                label: `${driver.staffName} (${driver.employeeId})`,
              }))}
            />
            <Field name="startAt" label="Start date and time" type="datetime-local" value={toDatetimeLocal(allocation?.startAt)} />
            <Field name="expectedEndAt" label="Expected return" type="datetime-local" value={toDatetimeLocal(allocation?.expectedEndAt)} />
            <Field name="notes" label="Notes" required={false} value={allocation?.notes} />
          </div>
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
            <button className="primary-action" disabled={!vehicleOptions.length || !driverOptions.length}>
              {allocation ? 'Save allocation' : 'Create allocation'}
            </button>
          </footer>
        </form>
      </section>
    </div>
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
}: {
  name: string;
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <select name={name} required={required} defaultValue={value ?? ''}>
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
