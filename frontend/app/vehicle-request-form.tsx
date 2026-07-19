'use client';

import { FormEvent, useEffect, useState } from 'react';

type SubmissionState =
  | { type: 'idle' }
  | { type: 'submitting' }
  | { type: 'success'; requestNumber: string }
  | { type: 'error'; message: string };

const API_URL = '/api';
const apiPath = (path: string) => `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

export function VehicleRequestForm({ embedded = false }: { embedded?: boolean }) {
  const [state, setState] = useState<SubmissionState>({ type: 'idle' });
  const [directorateId, setDirectorateId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [profile, setProfile] = useState<{ staffName: string; employeeId: string; directorateId?: string; departmentId?: string; unitId?: string } | null>(null);
  const directorates = useMasterOptions('directorates');
  const departments = useMasterOptions('departments', directorateId, Boolean(directorateId));
  const units = useMasterOptions('units', departmentId, Boolean(departmentId));
  const locations = useMasterOptions('locations');
  const vehicleTypes = useMasterOptions('vehicle-types');

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => response.ok ? response.json() : null).then((payload) => {
      if (!payload?.user) return;
      setProfile(payload.user);
      setDirectorateId(payload.user.directorateId ?? '');
      setDepartmentId(payload.user.departmentId ?? '');
      setUnitId(payload.user.unitId ?? '');
    }).catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const departureDate = String(formData.get('departureDate'));
    const expectedReturnDate = String(formData.get('expectedReturnDate'));

    if (new Date(expectedReturnDate) <= new Date(departureDate)) {
      setState({ type: 'error', message: 'Expected return date must be after departure date.' });
      return;
    }

    formData.set('departureDate', new Date(departureDate).toISOString());
    formData.set('expectedReturnDate', new Date(expectedReturnDate).toISOString());

    const attachment = formData.get('attachment');
    if (attachment instanceof File && attachment.size === 0) {
      formData.delete('attachment');
    } else if (attachment instanceof File && attachment.size > 10 * 1024 * 1024) {
      setState({ type: 'error', message: 'Attachment must not exceed 10 MB.' });
      return;
    }

    setState({ type: 'submitting' });

    try {
      const response = await fetch(apiPath('/vehicle-requests'), {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        requestNumber?: string;
        message?: string | string[];
      };

      if (!response.ok || !payload.requestNumber) {
        const message = Array.isArray(payload.message)
          ? payload.message.join(' ')
          : payload.message || 'The request could not be submitted.';
        throw new Error(message);
      }

      form.reset();
      setDirectorateId('');
      setDepartmentId('');
      setUnitId('');
      setState({ type: 'success', requestNumber: payload.requestNumber });
    } catch (error) {
      setState({
        type: 'error',
        message: error instanceof Error ? error.message : 'The request could not be submitted.',
      });
    }
  }

  return (
    <form
      className={`request-form ${embedded ? 'embedded' : ''}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <section className="form-section" aria-labelledby="staff-heading">
        <div className="section-heading">
          <span>01</span>
          <div>
            <h2 id="staff-heading">Staff details</h2>
            <p>Information about the staff member making this request.</p>
          </div>
        </div>
        <div className="field-grid">
          <Field label="Staff Name" name="staffName" minLength={2} maxLength={150} value={profile?.staffName} readOnly={Boolean(profile)} />
          <Field label="Employee ID" name="employeeId" maxLength={50} value={profile?.employeeId} readOnly={Boolean(profile)} />
          <MasterSelect
            label="Location"
            name="locationId"
            options={locations.options}
            loading={locations.loading}
          />
          <MasterSelect
            label="Directorate"
            name="directorateId"
            options={directorates.options}
            loading={directorates.loading}
            value={directorateId}
            onChange={(value) => {
              setDirectorateId(value);
              setDepartmentId('');
              setUnitId('');
            }}
          />
          <MasterSelect
            label="Department"
            name="departmentId"
            options={departments.options}
            loading={departments.loading}
            disabled={!directorateId}
            value={departmentId}
            onChange={(value) => {
              setDepartmentId(value);
              setUnitId('');
            }}
          />
          <MasterSelect
            label="Unit"
            name="unitId"
            options={units.options}
            loading={units.loading}
            disabled={!departmentId}
            value={unitId}
            onChange={setUnitId}
          />
        </div>
      </section>

      <section className="form-section" aria-labelledby="trip-heading">
        <div className="section-heading">
          <span>02</span>
          <div>
            <h2 id="trip-heading">Trip details</h2>
            <p>Provide the journey requirements for review and approval.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field field-wide">
            <span>Purpose of Trip</span>
            <textarea name="purposeOfTrip" required minLength={5} maxLength={2000} rows={4} />
          </label>
          <label className="field">
            <span>Vehicle Type</span>
            <MasterSelectControl
              name="vehicleTypeId"
              label="vehicle type"
              options={vehicleTypes.options}
              loading={vehicleTypes.loading}
            />
          </label>
          <label className="field">
            <span>Destination</span>
            <LocationNameSelect name="destination" options={locations.options} loading={locations.loading} />
          </label>
          <Field label="Departure Date" name="departureDate" type="datetime-local" />
          <Field label="Expected Return Date" name="expectedReturnDate" type="datetime-local" />
          <Field
            label="Number of Passengers"
            name="numberOfPassengers"
            type="number"
            min={1}
            max={100}
          />
          <label className="field">
            <span>Priority</span>
            <select name="priority" required defaultValue="NORMAL">
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="support-heading">
        <div className="section-heading">
          <span>03</span>
          <div>
            <h2 id="support-heading">Supporting information</h2>
            <p>Add context or an optional supporting document.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field field-wide">
            <span>Remarks</span>
            <textarea name="remarks" maxLength={2000} rows={3} />
          </label>
          <label className="field field-wide">
            <span>Attachment</span>
            <input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png" />
            <small>Optional. PDF, JPEG, or PNG; maximum 10 MB.</small>
          </label>
        </div>
      </section>

      <footer className="form-footer">
        <div className="status-note">
          <strong>Submission status</strong>
          <span>Pending Approval</span>
        </div>
        <button type="submit" disabled={state.type === 'submitting'}>
          {state.type === 'submitting' ? 'Submitting…' : 'Submit request'}
        </button>
      </footer>

      <div aria-live="polite" aria-atomic="true">
        {state.type === 'success' && (
          <p className="alert success">
            Request {state.requestNumber} was submitted and is pending approval.
          </p>
        )}
        {state.type === 'error' && <p className="alert error">{state.message}</p>}
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'datetime-local';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  value?: string;
  readOnly?: boolean;
};

function Field({ label, name, type = 'text', ...constraints }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} required {...constraints} />
    </label>
  );
}

type MasterOption = { id: string; name: string; code: string };

function useMasterOptions(resource: string, parentId?: string, enabled = true) {
  const [options, setOptions] = useState<MasterOption[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controller = new AbortController();
    void Promise.resolve().then(() => setLoading(true));
    const query = new URLSearchParams({
      activeOnly: 'true',
      limit: '100',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    if (parentId)
      query.set(resource === 'departments' ? 'directorateId' : 'departmentId', parentId);
    fetch(apiPath(`/${resource}?${query}`), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load options.');
        return response.json() as Promise<{ data?: MasterOption[] }>;
      })
      .then((payload) => setOptions(payload.data ?? []))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setOptions([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [enabled, parentId, resource]);

  return { options: enabled ? options : [], loading: enabled ? loading : false };
}

function MasterSelect({
  label,
  name,
  options,
  loading,
  disabled,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: MasterOption[];
  loading: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <MasterSelectControl
        name={name}
        label={label.toLowerCase()}
        options={options}
        loading={loading}
        disabled={disabled}
        value={value}
        onChange={onChange}
      />
      {!loading && !disabled && options.length === 0 && (
        <small>No active {label.toLowerCase()} records are available.</small>
      )}
    </label>
  );
}

function MasterSelectControl({
  name,
  label,
  options,
  loading,
  disabled,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: MasterOption[];
  loading: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <select
      name={name}
      required
      disabled={disabled || loading}
      value={value}
      defaultValue={value === undefined ? '' : undefined}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      <option value="" disabled>
        {loading ? 'Loading…' : disabled ? 'Select the parent record first' : `Select ${label}`}
      </option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name} ({option.code})
        </option>
      ))}
    </select>
  );
}

function LocationNameSelect({ name, options, loading }: { name: string; options: MasterOption[]; loading: boolean }) {
  return (
    <select name={name} required disabled={loading} defaultValue="">
      <option value="" disabled>{loading ? 'Loading…' : 'Select destination'}</option>
      {options.map((option) => <option key={option.id} value={option.name}>{option.name} ({option.code})</option>)}
    </select>
  );
}
