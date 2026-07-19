'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PageHeader } from './page-header';

type Option = { id: string; name: string; code: string };
type User = {
  id: string;
  staffName: string;
  employeeId: string;
  email: string;
  status: string;
  passportMimeType?: string;
  role: { name: string };
  location?: Option;
  directorate?: Option;
  department?: Option;
  unit?: Option;
};

const resources = ['roles', 'locations', 'directorates', 'departments', 'units'] as const;

export function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/users');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to load users.');
    setUsers(payload.data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'Unable to load users.'),
      );
      void Promise.all(
        resources.map(async (resource) => {
          const response = await fetch(`/api/${resource}?activeOnly=true&limit=100`);
          const payload = await response.json().catch(() => ({}));
          return [resource, payload.data || []] as const;
        }),
      )
        .then((entries) => setOptions(Object.fromEntries(entries)))
        .catch(() => setError('Unable to load form options.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    const passport = formData.get('passport');
    formData.delete('passport');
    const body = Object.fromEntries(formData);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message);
      if (passport instanceof File && passport.size) {
        const image = new FormData();
        image.set('passport', passport);
        const upload = await fetch(`/api/users/${payload.data.id}/passport`, {
          method: 'POST',
          body: image,
        });
        if (!upload.ok) throw new Error('User created, but passport upload failed.');
      }
      setOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage staff accounts, roles, and organizational assignments."
        actions={
          <button className="primary-action" onClick={() => setOpen(true)}>
            Add user
          </button>
        }
      />
      {error && <div className="master-alert">{error}</div>}
      <section className="master-panel">
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Employee ID</th>
                <th>Role</th>
                <th>Organization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.staffName}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>{user.employeeId}</td>
                  <td>{user.role.name}</td>
                  <td>
                    {[user.location?.name, user.directorate?.name, user.department?.name, user.unit?.name]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </td>
                  <td>
                    <span className={`record-status ${user.status.toLowerCase()}`}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="master-empty">
            <h2>No users yet</h2>
            <p>Add the first administrator account.</p>
          </div>
        )}
      </section>
      {open && (
        <div className="master-modal-backdrop">
          <section className="master-modal">
            <header>
              <div>
                <span>New account</span>
                <h2>Add user</h2>
              </div>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            <form onSubmit={save}>
              <div className="master-form-grid">
                <Field name="staffName" label="Staff name" />
                <Field name="employeeId" label="Employee ID" />
                <Field name="email" label="Email" type="email" />
                <Field name="phone" label="Phone" required={false} />
                <Field name="password" label="Temporary password" type="password" />
                <Select name="roleId" label="Role" options={options.roles} />
                <Select
                  name="locationId"
                  label="Location"
                  options={options.locations}
                  required={false}
                />
                <Select
                  name="directorateId"
                  label="Directorate"
                  options={options.directorates}
                  required={false}
                />
                <Select
                  name="departmentId"
                  label="Department"
                  options={options.departments}
                  required={false}
                />
                <Select name="unitId" label="Unit" options={options.units} required={false} />
              </div>
              {error && <div className="master-alert modal-alert">{error}</div>}
              <footer>
                <button type="button" className="secondary-action" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="primary-action" disabled={saving}>
                  {saving ? 'Saving…' : 'Save user'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <input name={name} type={type} required={required} minLength={type === 'password' ? 8 : undefined} />
    </label>
  );
}

function Select({
  name,
  label,
  options = [],
  required = true,
}: {
  name: string;
  label: string;
  options?: Option[];
  required?: boolean;
}) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <select name={name} required={required}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.code})
          </option>
        ))}
      </select>
    </label>
  );
}
