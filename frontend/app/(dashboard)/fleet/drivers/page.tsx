'use client';

import { PageHeader } from '@/components/page-header';
import { Pencil, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Driver = {
  id: string;
  serialNumber?: string | null;
  staffName: string;
  employeeId: string;
  locationText?: string | null;
  zone?: string | null;
  category?: string | null;
  phone: string;
  email?: string | null;
  status: string;
  passportMimeType?: string;
};

type Mode = { type: 'create'; driver?: undefined } | { type: 'edit'; driver: Driver };

export default function DriversPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const load = () => fetch('/api/drivers').then((r) => r.json()).then((p) => setItems(p.data || []));

  useEffect(() => {
    void load();
  }, []);

  const sortedItems = useMemo(() => [...items].sort(compareDriversBySerialNumber), [items]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const passport = fd.get('passport');
    fd.delete('passport');
    const editing = mode?.type === 'edit';
    const response = await fetch(`/api/drivers${editing ? `/${mode.driver.id}` : ''}`, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message);
      return;
    }
    if (passport instanceof File && passport.size) {
      const upload = new FormData();
      upload.set('passport', passport);
      await fetch(`/api/drivers/${payload.data.id}/passport`, { method: 'POST', body: upload });
    }
    setMode(null);
    setError('');
    await load();
  }

  async function remove(driver: Driver) {
    if (!window.confirm(`Delete driver ${driver.staffName}?`)) return;
    const response = await fetch(`/api/drivers/${driver.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Unable to delete driver.');
      return;
    }
    setError('');
    await load();
  }

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Manage the approved driver register."
        actions={
          <button className="primary-action" onClick={() => setMode({ type: 'create' })}>
            Add driver
          </button>
        }
      />
      {error && <div className="master-alert">{error}</div>}
      <section className="master-panel">
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Driver&apos;s Name</th>
                <th>Location</th>
                <th>Zone</th>
                <th>Category</th>
                <th>ID Number</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.serialNumber || '—'}</td>
                  <td>
                    {driver.passportMimeType && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="avatar" src={`/api/drivers/${driver.id}/passport`} alt="" />
                    )}
                    {driver.staffName}
                  </td>
                  <td>{driver.locationText || '—'}</td>
                  <td>{driver.zone || '—'}</td>
                  <td>{driver.category || '—'}</td>
                  <td>{driver.employeeId}</td>
                  <td>{driver.email || '—'}</td>
                  <td>{driver.phone}</td>
                  <td>{driver.status.replaceAll('_', ' ')}</td>
                  <td>
                    <div className="row-actions">
                      <button aria-label={`Edit ${driver.staffName}`} onClick={() => setMode({ type: 'edit', driver })}>
                        <Pencil size={15} />
                      </button>
                      <button aria-label={`Delete ${driver.staffName}`} onClick={() => void remove(driver)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <div className="master-empty">
            <h2>No drivers yet</h2>
            <p>Add the first approved driver.</p>
          </div>
        )}
      </section>
      {mode && (
        <DriverModal
          mode={mode}
          onClose={() => setMode(null)}
          onSubmit={(event) => void save(event)}
        />
      )}
    </>
  );
}

function DriverModal({
  mode,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const driver = mode.driver;
  return (
    <div className="master-modal-backdrop">
      <section className="master-modal wide-modal">
        <header>
          <div>
            <span>Driver register</span>
            <h2>{driver ? 'Edit driver' : 'Add driver'}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="master-form-grid">
            <Field name="serialNumber" label="S/N" value={driver?.serialNumber} required={false} />
            <Field name="staffName" label="Driver's Name" value={driver?.staffName} />
            <Field name="locationText" label="Location" value={driver?.locationText} required={false} />
            <Field name="zone" label="Zone" value={driver?.zone} required={false} />
            <label className="master-field">
              <span>Category</span>
              <select name="category" defaultValue={driver?.category ?? ''}>
                <option value="">Select category</option>
                <option value="OUTSOURCED">Outsourced</option>
                <option value="PERMANENT STAFF">Permanent Staff</option>
              </select>
            </label>
            <Field name="employeeId" label="ID Number" value={driver?.employeeId} />
            <Field name="email" label="Email" type="email" required={false} value={driver?.email} />
            <Field name="phone" label="Phone Number" value={driver?.phone} />
            <label className="master-field">
              <span>Status</span>
              <select name="status" defaultValue={driver?.status ?? 'AVAILABLE'}>
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="master-field full">
              <span>Passport photograph</span>
              <input name="passport" type="file" accept="image/jpeg,image/png,image/webp" />
              {driver?.passportMimeType && <small>Leave empty to keep the current photograph.</small>}
            </label>
          </div>
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action">Save driver</button>
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
  value?: string | number | null;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <input name={name} type={type} required={required} defaultValue={value ?? ''} />
    </label>
  );
}

function compareDriversBySerialNumber(a: Driver, b: Driver) {
  const aSerial = normaliseSerial(a.serialNumber);
  const bSerial = normaliseSerial(b.serialNumber);
  if (aSerial.numeric != null && bSerial.numeric != null && aSerial.numeric !== bSerial.numeric) return aSerial.numeric - bSerial.numeric;
  if (aSerial.text !== bSerial.text) return aSerial.text.localeCompare(bSerial.text, undefined, { numeric: true });
  return a.staffName.localeCompare(b.staffName);
}

function normaliseSerial(value?: string | null) {
  const text = (value || '').trim();
  const numeric = Number(text.replace(/[^0-9.]/g, ''));
  return { text: text || '999999999', numeric: Number.isFinite(numeric) && text ? numeric : null };
}
