'use client';

import { PageHeader } from '@/components/page-header';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Vehicle = {
  id: string;
  registrationNumber: string;
  serialNumber?: string | null;
  locationUser?: string | null;
  privateRegistrationNumber?: string | null;
  officialRegistrationNumber?: string | null;
  manufacturer: string;
  model: string;
  year?: number | null;
  purchaseCost?: string | null;
  bookedValue?: string | null;
  estimatedCost?: string | null;
  reservedPresentValue?: string | null;
  age?: string | null;
  serviceability?: string | null;
  legacyAgency?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  remark?: string | null;
  faultDescription?: string | null;
  color?: string | null;
  status: string;
  imageMimeType?: string;
};

type Mode = { type: 'create'; vehicle?: undefined } | { type: 'edit'; vehicle: Vehicle };

export default function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = () =>
    fetch('/api/vehicles')
      .then((response) => response.json())
      .then((payload) => setItems(payload.data || []));

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items
      .filter((vehicle) => {
        if (statusFilter && vehicle.status !== statusFilter) return false;
        if (!search) return true;
        return [
        vehicle.serialNumber,
        vehicle.locationUser,
        vehicle.privateRegistrationNumber,
        vehicle.officialRegistrationNumber,
        vehicle.registrationNumber,
        vehicle.manufacturer,
        vehicle.model,
        vehicle.purchaseCost,
        vehicle.bookedValue,
        vehicle.estimatedCost,
        vehicle.reservedPresentValue,
        vehicle.age,
        vehicle.year ? String(vehicle.year) : '',
        vehicle.serviceability,
        vehicle.legacyAgency,
        vehicle.chassisNumber,
        vehicle.engineNumber,
        vehicle.status,
        vehicle.remark,
        vehicle.faultDescription,
      ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort(compareVehiclesBySerialNumber);
  }, [items, query, statusFilter]);

  const visibleIds = filteredItems.map((vehicle) => vehicle.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const image = formData.get('image');
    formData.delete('image');
    const editing = mode?.type === 'edit';
    const response = await fetch(`/api/vehicles${editing ? `/${mode.vehicle.id}` : ''}`, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message);
      return;
    }
    if (image instanceof File && image.size) {
      const upload = new FormData();
      upload.set('image', image);
      await fetch(`/api/vehicles/${payload.data.id}/image`, { method: 'POST', body: upload });
    }
    setMode(null);
    setError('');
    setSelectedIds([]);
    await load();
  }

  async function remove(vehicle: Vehicle) {
    const label =
      vehicle.officialRegistrationNumber || vehicle.privateRegistrationNumber || vehicle.registrationNumber;
    if (!window.confirm(`Delete vehicle ${label}?`)) return;
    const response = await fetch(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(
        Array.isArray(payload.message)
          ? payload.message.join(' ')
          : payload.message || 'Unable to delete vehicle.',
      );
      return;
    }
    setError('');
    setSelectedIds((current) => current.filter((id) => id !== vehicle.id));
    await load();
  }

  function toggleVehicle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected vehicle(s)?`)) return;
    const response = await fetch('/api/vehicles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Unable to delete selected vehicles.');
      return;
    }
    const blocked = payload.blocked?.length
      ? ` Blocked: ${payload.blocked.map((item: { label: string }) => item.label).join(', ')}.`
      : '';
    setError(
      blocked
        ? `Deleted ${payload.summary?.deleted ?? 0} vehicle(s).${blocked}`
        : '',
    );
    setSelectedIds([]);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Manage vehicles and full register details in the fleet register."
        actions={
          <button className="primary-action" onClick={() => setMode({ type: 'create' })}>
            Add vehicle
          </button>
        }
      />
      {error && <div className="master-alert">{error}</div>}
      <section className="master-panel">
        <div className="master-toolbar">
          <label>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vehicle, reg no, location, chassis, engine..."
            />
          </label>
          <div className="master-filters">
            <button
              className="danger-action"
              disabled={!selectedIds.length}
              onClick={() => void bulkDelete()}
            >
              <Trash2 size={15} /> Delete selected ({selectedIds.length})
            </button>
            <select
              aria-label="Filter vehicles by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="IN_USE">In use</option>
              <option value="RESERVED">Reserved</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OUT_OF_SERVICE">Out of service</option>
            </select>
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select all visible vehicles"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>S/N</th>
                <th>Location/User</th>
                <th>Vehicle Type/Make</th>
                <th>Private Reg. Number</th>
                <th>Official Reg. Number</th>
                <th>Purchase Cost</th>
                <th>Booked Value (N)</th>
                <th>Estimated Cost (N)</th>
                <th>Reserved Present Value</th>
                <th>Age</th>
                <th>Year of Purchase</th>
                <th>Serviceable/Unserviceable</th>
                <th>Legacy Agency</th>
                <th>Chassis Number</th>
                <th>Engine Number</th>
                <th>Status</th>
                <th>Remark</th>
                <th>Description of Fault</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>
                    <input
                      aria-label={`Select ${vehicle.officialRegistrationNumber || vehicle.privateRegistrationNumber || vehicle.registrationNumber}`}
                      type="checkbox"
                      checked={selectedIds.includes(vehicle.id)}
                      onChange={() => toggleVehicle(vehicle.id)}
                    />
                  </td>
                  <td>
                    {vehicle.imageMimeType && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="avatar" src={`/api/vehicles/${vehicle.id}/image`} alt="" />
                    )}
                    {vehicle.serialNumber || '—'}
                  </td>
                  <td>{vehicle.locationUser || '—'}</td>
                  <td>{`${vehicle.manufacturer} ${vehicle.model}`.trim()}</td>
                  <td>{vehicle.privateRegistrationNumber || '—'}</td>
                  <td>{vehicle.officialRegistrationNumber || '—'}</td>
                  <td>{vehicle.purchaseCost || '—'}</td>
                  <td>{vehicle.bookedValue || '—'}</td>
                  <td>{vehicle.estimatedCost || '—'}</td>
                  <td>{vehicle.reservedPresentValue || '—'}</td>
                  <td>{vehicle.age || '—'}</td>
                  <td>{vehicle.year || '—'}</td>
                  <td>{vehicle.serviceability || '—'}</td>
                  <td>{vehicle.legacyAgency || '—'}</td>
                  <td>{vehicle.chassisNumber || '—'}</td>
                  <td>{vehicle.engineNumber || '—'}</td>
                  <td>{vehicle.status.replaceAll('_', ' ')}</td>
                  <td>{vehicle.remark || '—'}</td>
                  <td>{vehicle.faultDescription || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        aria-label={`Edit ${
                          vehicle.officialRegistrationNumber ||
                          vehicle.privateRegistrationNumber ||
                          vehicle.registrationNumber
                        }`}
                        onClick={() => setMode({ type: 'edit', vehicle })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`Delete ${
                          vehicle.officialRegistrationNumber ||
                          vehicle.privateRegistrationNumber ||
                          vehicle.registrationNumber
                        }`}
                        onClick={() => void remove(vehicle)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="master-empty">
            <h2>No matching vehicles</h2>
            <p>Try another registration number, location/user, chassis, engine, make, or status.</p>
          </div>
        )}
      </section>
      {mode && (
        <VehicleModal
          mode={mode}
          onClose={() => setMode(null)}
          onSubmit={(event) => void save(event)}
        />
      )}
    </>
  );
}

function VehicleModal({
  mode,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const vehicle = mode.vehicle;
  return (
    <div className="master-modal-backdrop">
      <section className="master-modal wide-modal">
        <header>
          <div>
            <span>Fleet register</span>
            <h2>{vehicle ? 'Edit vehicle' : 'Add vehicle'}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="master-form-grid">
            <Field name="serialNumber" label="S/N" value={vehicle?.serialNumber} required={false} />
            <Field name="locationUser" label="Location/User" value={vehicle?.locationUser} required={false} />
            <Field name="manufacturer" label="Manufacturer" value={vehicle?.manufacturer} />
            <Field name="model" label="Model" value={vehicle?.model} />
            <Field name="privateRegistrationNumber" label="Private reg. number" value={vehicle?.privateRegistrationNumber} required={false} />
            <Field name="officialRegistrationNumber" label="Official reg. number" value={vehicle?.officialRegistrationNumber} required={false} />
            <Field name="purchaseCost" label="Purchase cost" value={vehicle?.purchaseCost} required={false} />
            <Field name="bookedValue" label="Booked value (N)" value={vehicle?.bookedValue} required={false} />
            <Field name="estimatedCost" label="Estimated cost (N)" value={vehicle?.estimatedCost} required={false} />
            <Field name="reservedPresentValue" label="Reserved present value" value={vehicle?.reservedPresentValue} required={false} />
            <Field name="age" label="Age" value={vehicle?.age} required={false} />
            <Field name="year" label="Year of purchase" type="number" value={vehicle?.year} required={false} />
            <Field name="serviceability" label="Serviceable/Unserviceable" value={vehicle?.serviceability} required={false} />
            <Field name="legacyAgency" label="Legacy agency" value={vehicle?.legacyAgency} required={false} />
            <Field name="chassisNumber" label="Chassis number" value={vehicle?.chassisNumber} required={false} />
            <Field name="engineNumber" label="Engine number" value={vehicle?.engineNumber} required={false} />
            <Field name="color" label="Color" value={vehicle?.color} required={false} />
            <label className="master-field">
              <span>Status</span>
              <select name="status" defaultValue={vehicle?.status ?? 'AVAILABLE'}>
                <option value="AVAILABLE">Available</option>
                <option value="IN_USE">In use</option>
                <option value="RESERVED">Reserved</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OUT_OF_SERVICE">Out of service</option>
              </select>
            </label>
            <Field name="remark" label="Remark" value={vehicle?.remark} required={false} full />
            <Field name="faultDescription" label="Description of fault" value={vehicle?.faultDescription} required={false} full />
            <label className="master-field full">
              <span>Vehicle photograph</span>
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              {vehicle?.imageMimeType && <small>Leave empty to keep the current image.</small>}
            </label>
          </div>
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action">Save vehicle</button>
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
  full = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string | number | null;
  full?: boolean;
}) {
  return (
    <label className={`master-field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      <input name={name} type={type} required={required} defaultValue={value ?? ''} />
    </label>
  );
}

function compareVehiclesBySerialNumber(a: Vehicle, b: Vehicle) {
  const aSerial = normaliseSerial(a.serialNumber);
  const bSerial = normaliseSerial(b.serialNumber);
  if (aSerial.numeric != null && bSerial.numeric != null && aSerial.numeric !== bSerial.numeric) {
    return aSerial.numeric - bSerial.numeric;
  }
  if (aSerial.text !== bSerial.text) return aSerial.text.localeCompare(bSerial.text, undefined, { numeric: true });
  return (a.officialRegistrationNumber || a.privateRegistrationNumber || a.registrationNumber).localeCompare(
    b.officialRegistrationNumber || b.privateRegistrationNumber || b.registrationNumber,
  );
}

function normaliseSerial(value?: string | null) {
  const text = (value || '').trim();
  const numeric = Number(text.replace(/[^0-9.]/g, ''));
  return {
    text: text || '999999999',
    numeric: Number.isFinite(numeric) && text ? numeric : null,
  };
}
