'use client';

import { PageHeader } from '@/components/page-header';
import { apiMessage, readApiJson } from '@/lib/api-response';
import { Pencil, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Vehicle = { id: string; registrationNumber: string; manufacturer: string; model: string; status: string };
type Driver = { id: string; staffName: string; employeeId: string; status: string };
type Location = { id: string; name: string; code: string };
type CurrentUser = { employeeId: string; role: { code: string; name: string } };
type Allocation = {
  id: string;
  purpose: string;
  destination?: string;
  startAt: string;
  expectedEndAt: string;
  notes?: string;
  status: string;
  vehicle: Vehicle;
  driver: Driver;
};
type Mode = { type: 'create'; allocation?: undefined } | { type: 'edit'; allocation: Allocation };

export default function AllocationPage() {
  const [items, setItems] = useState<Allocation[]>([]),
    [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [drivers, setDrivers] = useState<Driver[]>([]),
    [locations, setLocations] = useState<Location[]>([]),
    [currentUser, setCurrentUser] = useState<CurrentUser | null>(null),
    [mode, setMode] = useState<Mode | null>(null),
    [error, setError] = useState('');

  const load = useCallback(async () => {
    const [mePayload, allocations, vehiclePayload, driverPayload, locationPayload] = await Promise.all([
      fetch('/api/auth/me').then((r) => (r.ok ? readApiJson<{ user?: CurrentUser }>(r) : null)),
      fetch('/api/vehicle-allocations').then((r) => readApiJson<{ data?: Allocation[] }>(r)),
      fetch('/api/vehicles').then((r) => readApiJson<{ data?: Vehicle[] }>(r)),
      fetch('/api/drivers').then((r) => readApiJson<{ data?: Driver[] }>(r)),
      fetch('/api/locations?activeOnly=true&limit=100&sortBy=name&sortOrder=asc').then((r) =>
        readApiJson<{ data?: Location[] }>(r),
      ),
    ]);
    setCurrentUser(mePayload?.user ?? null);
    setItems(allocations.data || []);
    setVehicles(vehiclePayload.data || []);
    setDrivers(driverPayload.data || []);
    setLocations(locationPayload.data || []);
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
      setError(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message);
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
            ? 'View vehicles currently allocated to you for field operations.'
            : 'Assign available vehicles and approved drivers to operations.'
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
                    <small>
                      {allocation.vehicle.manufacturer} {allocation.vehicle.model}
                    </small>
                  </td>
                  <td>
                    <strong>{allocation.driver.staffName}</strong>
                    <small>{allocation.driver.employeeId}</small>
                  </td>
                  <td>
                    {allocation.purpose}
                    <small>{allocation.destination || ''}</small>
                  </td>
                  <td>
                    {new Date(allocation.startAt).toLocaleString()}
                    <small>to {new Date(allocation.expectedEndAt).toLocaleString()}</small>
                  </td>
                  <td>{allocation.status}</td>
                  <td>
                    <div className="row-actions">
                      {canManageAllocations && allocation.status === 'ACTIVE' && (
                        <>
                          <button
                            aria-label={`Edit allocation ${allocation.id}`}
                            onClick={() => setMode({ type: 'edit', allocation })}
                          >
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
                ? 'When fleet admin assigns a vehicle to your employee ID, it will appear here.'
                : 'Assign an available vehicle and driver.'}
            </p>
          </div>
        )}
      </section>
      {mode && canManageAllocations && (
        <AllocationModal
          mode={mode}
          vehicles={vehicles}
          drivers={drivers}
          locations={locations}
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
  locations,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  vehicles: Vehicle[];
  drivers: Driver[];
  locations: Location[];
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
            <h2>{allocation ? 'Edit allocation' : 'Allocate vehicle'}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="master-form-grid">
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
            <Field name="purpose" label="Purpose" value={allocation?.purpose} />
            <Select
              name="destination"
              label="Destination"
              placeholder="Select registered location"
              value={allocation?.destination}
              options={locations.map((location) => ({
                id: location.name,
                label: `${location.name} (${location.code})`,
              }))}
            />
            <Field
              name="startAt"
              label="Start date and time"
              type="datetime-local"
              value={toDatetimeLocal(allocation?.startAt)}
            />
            <Field
              name="expectedEndAt"
              label="Expected return"
              type="datetime-local"
              value={toDatetimeLocal(allocation?.expectedEndAt)}
            />
            <Field name="notes" label="Notes" required={false} value={allocation?.notes} />
          </div>
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action" disabled={!vehicleOptions.length || !driverOptions.length}>
              {allocation ? 'Save allocation' : 'Create allocation'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = true,
  value,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
}) {
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
}: {
  name: string;
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  value?: string;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <select name={name} required defaultValue={value ?? ''}>
        <option value="" disabled>
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
