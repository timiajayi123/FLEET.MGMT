'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

type SubmissionState =
  | { type: 'idle' }
  | { type: 'submitting' }
  | { type: 'success'; requestNumber: string }
  | { type: 'error'; message: string };

const API_URL = '/api';
const apiPath = (path: string) => `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

export function VehicleRequestForm({ embedded = false }: { embedded?: boolean }) {
  const [state, setState] = useState<SubmissionState>({ type: 'idle' });
  const [departureError, setDepartureError] = useState('');
  const [dateError, setDateError] = useState('');
  const [departureMinimum, setDepartureMinimum] = useState(() => localDepartureMinimum());
  const [departureValue, setDepartureValue] = useState('');
  const [destinationError, setDestinationError] = useState('');
  const [directorateId, setDirectorateId] = useState('');
  const [locationValue, setLocationValue] = useState('');
  const [departmentValue, setDepartmentValue] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  const [profile, setProfile] = useState<{
    staffName: string;
    employeeId: string;
    directorateId?: string;
  } | null>(null);
  const directorates = useMasterOptions('directorates');
  const departments = useMasterOptions('departments', directorateId, Boolean(directorateId));
  const locations = useMasterOptions('locations');
  const vehicleTypes = useMasterOptions('vehicle-types');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload?.user) return;
        setProfile(payload.user);
        setDirectorateId(payload.user.directorateId ?? '');
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const refreshMinimum = () => {
      const minimum = localDepartureMinimum();
      setDepartureMinimum(minimum);
      if (departureValue && departureHasPassed(departureValue)) {
        setDepartureError('The selected departure date and time has already passed. Choose a future time.');
      }
    };
    const timer = window.setInterval(refreshMinimum, 30_000);
    window.addEventListener('focus', refreshMinimum);
    document.addEventListener('visibilitychange', refreshMinimum);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshMinimum);
      document.removeEventListener('visibilitychange', refreshMinimum);
    };
  }, [departureValue]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const departureInput = form.elements.namedItem('departureDate');

    if (
      departureInput instanceof HTMLInputElement &&
      departureInput.value &&
      departureHasPassed(departureInput.value)
    ) {
      const message =
        'The selected departure date and time has already passed. Choose a future time.';
      departureInput.setCustomValidity(message);
      setDepartureError(message);
      setState({ type: 'error', message });
      departureInput.reportValidity();
      departureInput.focus();
      departureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (departureInput instanceof HTMLInputElement) departureInput.setCustomValidity('');

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    if (sameDestination(locationValue, destinationValue)) {
      setDestinationError('Destination From and Destination To cannot be the same location.');
      return;
    }
    setDestinationError('');
    const destinationMatch = locations.options.find(
      (option) => option.name.toLocaleLowerCase() === destinationValue.trim().toLocaleLowerCase(),
    );
    formData.set('customDestination', destinationMatch ? '' : destinationValue.trim());
    const departureDate = String(formData.get('departureDate'));
    const expectedReturnDate = String(formData.get('expectedReturnDate'));

    if (new Date(expectedReturnDate) <= new Date(departureDate)) {
      const message = 'Expected return date must be after the departure date.';
      setDateError(message);
      setState({ type: 'error', message });
      const returnDateInput = form.elements.namedItem('expectedReturnDate');
      if (returnDateInput instanceof HTMLInputElement) {
        returnDateInput.focus();
        returnDateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setDateError('');

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
      setLocationValue('');
      setDepartmentValue('');
      setDestinationValue('');
      setDepartureValue('');
      setDepartureError('');
      setDateError('');
      setDestinationError('');
      setState({ type: 'success', requestNumber: payload.requestNumber });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The request could not be submitted.';
      if (message.toLowerCase().includes('departure') && message.toLowerCase().includes('passed')) {
        setDepartureError(message);
      }
      setState({
        type: 'error',
        message,
      });
    }
  }

  return (
    <form
      className={`request-form ${embedded ? 'embedded' : ''}`}
      onSubmit={handleSubmit}
      onChange={(event) => {
        const field = event.target;
        if (
          dateError &&
          field instanceof HTMLInputElement &&
          ['departureDate', 'expectedReturnDate'].includes(field.name)
        ) {
          setDateError('');
          if (state.type === 'error') setState({ type: 'idle' });
        }
      }}
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
          <Field
            label="Staff Name"
            name="staffName"
            minLength={2}
            maxLength={150}
            value={profile?.staffName}
            readOnly={Boolean(profile)}
          />
          <Field
            label="Employee ID"
            name="employeeId"
            maxLength={50}
            value={profile?.employeeId}
            readOnly={Boolean(profile)}
          />
          <MasterSelect
            label="Directorate"
            name="directorateId"
            options={directorates.options}
            loading={directorates.loading}
            value={directorateId}
            onChange={(value) => {
              setDirectorateId(value);
              setDepartmentValue('');
            }}
          />
          <CreatableMasterField
            label="Department"
            options={departments.options}
            loading={departments.loading}
            value={departmentValue}
            idName="departmentId"
            customName="customDepartment"
            onChange={(value) => {
              setDepartmentValue(value);
            }}
          />
          <Field label="Unit (Optional)" name="customUnit" required={false} minLength={2} maxLength={200} />
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
            <select name="purposeOfTrip" required defaultValue="">
              <option value="" disabled>
                Select trip purpose
              </option>
              <option value="Official">Official</option>
              <option value="Non-Official">Non-Official</option>
            </select>
          </label>
          <label className="field field-wide">
            <span>Purpose details</span>
            <textarea
              name="remarks"
              required
              minLength={2}
              maxLength={2000}
              rows={3}
              placeholder="Describe the purpose of the trip."
            />
          </label>
          <label className="field field-wide">
            <span>Vehicle Type</span>
            <MasterSelectControl
              name="vehicleTypeId"
              label="vehicle type"
              options={vehicleTypes.options}
              loading={vehicleTypes.loading}
            />
          </label>
          <CreatableMasterField
            label="Destination From"
            options={locations.options}
            loading={locations.loading}
            value={locationValue}
            onChange={(value) => {
              setLocationValue(value);
              setDestinationError(
                sameDestination(value, destinationValue)
                  ? 'Destination From and Destination To cannot be the same location.'
                  : '',
              );
            }}
            idName="locationId"
            customName="customPickupLocation"
          />
          <label className={`field ${destinationError ? 'field-invalid' : ''}`}>
            <span>Destination To</span>
            <input
              name="destination"
              list="vehicle-request-destinations"
              value={destinationValue}
              onChange={(event) => {
                const value = event.target.value;
                setDestinationValue(value);
                setDestinationError(
                  sameDestination(locationValue, value)
                    ? 'Destination From and Destination To cannot be the same location.'
                    : '',
                );
              }}
              required
              minLength={2}
              maxLength={300}
              placeholder="Select a registered location or type a destination"
              disabled={locations.loading}
              aria-invalid={Boolean(destinationError)}
              aria-describedby={destinationError ? 'destination-location-error' : undefined}
            />
            <datalist id="vehicle-request-destinations">
              {locations.options.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.code}
                </option>
              ))}
            </datalist>
          </label>
          {destinationError && (
            <p
              id="destination-location-error"
              className="field-validation-error field-wide"
              role="alert"
            >
              <strong>Select a different destination</strong>
              <span>{destinationError}</span>
            </p>
          )}
          <label className={`field ${departureError ? 'field-invalid' : ''}`}>
            <span>Departure Date</span>
            <input
              name="departureDate"
              type="datetime-local"
              required
              min={departureMinimum}
              value={departureValue}
              aria-invalid={Boolean(departureError)}
              aria-describedby={departureError ? 'departure-date-error' : undefined}
              onChange={(event) => {
                const value = event.target.value;
                setDepartureValue(value);
                const message =
                  value && departureHasPassed(value)
                    ? 'The selected departure date and time has already passed. Choose a future time.'
                    : '';
                event.target.setCustomValidity(message);
                setDepartureError(message);
                if (!message && state.type === 'error') setState({ type: 'idle' });
              }}
              onFocus={() => setDepartureMinimum(localDepartureMinimum())}
            />
          </label>
          {departureError && (
            <p
              id="departure-date-error"
              className="field-validation-error field-wide"
              role="alert"
            >
              <strong>Choose a future departure</strong>
              <span>{departureError}</span>
            </p>
          )}
          <label className={`field ${dateError ? 'field-invalid' : ''}`}>
            <span>Expected Return Date</span>
            <input
              name="expectedReturnDate"
              type="datetime-local"
              required
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? 'return-date-error' : undefined}
            />
          </label>
          {dateError && (
            <p id="return-date-error" className="field-validation-error field-wide" role="alert">
              <strong>Check the return date</strong>
              <span>{dateError}</span>
            </p>
          )}
          <Field
            label="Number of Passengers (Optional)"
            name="numberOfPassengers"
            type="number"
            min={1}
            max={100}
            required={false}
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
            <p>Upload an optional document that supports this request.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field field-wide">
            <span>Supporting document (Optional)</span>
            <input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png" />
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
        {state.type === 'error' && !dateError && !departureError && (
          <p className="alert error">{state.message}</p>
        )}
      </div>
      {state.type === 'success' && (
        <div className="request-success-backdrop" role="presentation">
          <section
            className="request-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-success-title"
          >
            <div className="request-success-icon">
              <CheckCircle2 size={40} />
            </div>
            <h2 id="request-success-title">Request submitted</h2>
            <p>Request number: <strong>{state.requestNumber}</strong></p>
            <button type="button" className="primary-action" onClick={() => setState({ type: 'idle' })}>
              Done
            </button>
          </section>
        </div>
      )}
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
  required?: boolean;
};

function Field({ label, name, type = 'text', required = true, ...constraints }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} required={required} {...constraints} />
    </label>
  );
}

type MasterOption = { id: string; name: string; code: string };

function sameDestination(from: string, to: string) {
  const normalise = (value: string) => value.trim().toLocaleLowerCase();
  return Boolean(normalise(from) && normalise(to) && normalise(from) === normalise(to));
}

function localDepartureMinimum(now = new Date()) {
  const minimum = new Date(now);
  minimum.setSeconds(0, 0);
  minimum.setMinutes(minimum.getMinutes() + 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${minimum.getFullYear()}-${pad(minimum.getMonth() + 1)}-${pad(minimum.getDate())}T${pad(minimum.getHours())}:${pad(minimum.getMinutes())}`;
}

function departureHasPassed(value: string, now = new Date()) {
  const departure = new Date(value);
  return Number.isFinite(departure.getTime()) && departure.getTime() <= now.getTime();
}

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

function CreatableMasterField({
  label,
  options,
  loading,
  value,
  onChange,
  idName,
  customName,
}: {
  label: string;
  options: MasterOption[];
  loading: boolean;
  value: string;
  onChange: (value: string, id: string) => void;
  idName: string;
  customName: string;
}) {
  const listId = `vehicle-request-${idName}`;
  return (
    <>
      <label className="field">
        <span>{label}</span>
        <input
          list={listId}
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            const match = options.find(
              (option) => option.name.toLocaleLowerCase() === next.trim().toLocaleLowerCase(),
            );
            onChange(next, match?.id ?? '');
          }}
          placeholder={loading ? 'Loading…' : `Select a saved ${label.toLowerCase()} or type one`}
          required
          minLength={2}
          maxLength={label === 'Location' ? 300 : 200}
          disabled={loading}
        />
        <input
          type="hidden"
          name={idName}
          value={
            options.find(
              (option) => option.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
            )?.id ?? ''
          }
        />
        <input
          type="hidden"
          name={customName}
          value={
            options.some(
              (option) => option.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
            )
              ? ''
              : value.trim()
          }
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.id} value={option.name}>
              {option.code}
            </option>
          ))}
        </datalist>
      </label>
      <select
        name={`legacy-${idName}`}
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        disabled
      >
        <option value="" disabled>
          {loading ? 'Loading…' : 'Select destination'}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name} ({option.code})
          </option>
        ))}
      </select>
    </>
  );
}
