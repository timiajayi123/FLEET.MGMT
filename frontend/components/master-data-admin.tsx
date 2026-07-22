'use client';

import { PageHeader } from '@/components/page-header';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { MasterDataResource, masterDataResources } from './master-data-config';

const API_URL = '/api';
const apiPath = (path: string) => `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

type RecordItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  directorateId?: string;
  departmentId?: string;
  directorate?: { id: string; name: string; code: string };
  department?: { id: string; name: string; code: string };
  address?: string | null;
  state?: string | null;
  passengerCapacity?: number | null;
  mapIcon?: string | null;
  mapIconMimeType?: string | null;
  isSystemRole?: boolean;
};
type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sortBy: SortField;
  sortOrder: SortOrder;
};
type SortField = 'name' | 'code' | 'status' | 'sortOrder' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type Config = (typeof masterDataResources)[MasterDataResource];
type Modal = 'create' | 'edit' | 'view' | 'archive' | null;

export function MasterDataAdmin({
  resource,
  config,
}: {
  resource: MasterDataResource;
  config: Config;
}) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [parents, setParents] = useState<RecordItem[]>([]);
  const defaultSortBy = resource === 'locations' ? 'createdAt' : 'name';
  const defaultSortOrder = resource === 'locations' ? 'desc' : 'asc';
  const [meta, setMeta] = useState<Meta>({
    page: 1,
    limit: resource === 'locations' ? 50 : 10,
    total: 0,
    totalPages: 0,
    sortBy: defaultSortBy,
    sortOrder: defaultSortOrder,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const hardDelete = resource === 'locations';

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(meta.page),
        limit: String(meta.limit),
        sortBy: meta.sortBy,
        sortOrder: meta.sortOrder,
      });
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      const response = await fetch(apiPath(`/${resource}?${query}`), { cache: 'no-store', credentials: 'include' });
      const payload = (await response.json()) as {
        data?: RecordItem[];
        meta?: Meta;
        message?: string | string[];
      };
      if (!response.ok) throw new Error(messageOf(payload.message, 'Unable to load records.'));
      setRecords(payload.data ?? []);
      if (payload.meta) setMeta(payload.meta);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load records.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [meta.limit, meta.page, meta.sortBy, meta.sortOrder, resource, search, status]);

  useEffect(() => {
    void Promise.resolve().then(loadRecords);
  }, [loadRecords]);

  useEffect(() => {
    if (!('parentResource' in config)) return;
    fetch(
      apiPath(`/${config.parentResource}?status=ACTIVE&limit=100&sortBy=name&sortOrder=asc`),
      { cache: 'no-store', credentials: 'include' },
    )
      .then((response) => response.json())
      .then((payload: { data?: RecordItem[] }) => setParents(payload.data ?? []))
      .catch(() => setParents([]));
  }, [config]);

  function changeSort(field: SortField) {
    setMeta((current) => ({
      ...current,
      page: 1,
      sortBy: field,
      sortOrder: current.sortBy === field && current.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setMeta((current) => ({ ...current, page: 1 }));
    setSearch(searchInput.trim());
  }

  function openModal(next: Exclude<Modal, null>, record: RecordItem | null = null) {
    setSelected(record);
    setError('');
    setModal(next);
  }

  function showSuccess(message: string) {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), 3500);
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const mapIconFile = formData.get('mapIconFile');
    formData.delete('mapIconFile');
    const body = Object.fromEntries(formData.entries());
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        apiPath(`/${resource}${modal === 'edit' && selected ? `/${selected.id}` : ''}`),
        {
          method: modal === 'edit' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as { data?: { id: string }; message?: string | string[] };
      if (!response.ok) throw new Error(messageOf(payload.message, 'Unable to save record.'));
      if (resource === 'vehicle-types' && mapIconFile instanceof File && mapIconFile.size) {
        if (mapIconFile.size > 2 * 1024 * 1024) throw new Error('Map icon must not exceed 2 MB.');
        const iconData = new FormData();
        iconData.set('mapIcon', mapIconFile);
        const iconResponse = await fetch(apiPath(`/vehicle-types/${payload.data?.id ?? selected?.id}/map-icon`), { method: 'POST', credentials: 'include', body: iconData });
        const iconPayload = await iconResponse.json().catch(() => ({}));
        if (!iconResponse.ok) throw new Error(messageOf(iconPayload.message, 'Vehicle Type was saved, but the map icon could not be uploaded.'));
      }
      setModal(null);
      setSelected(null);
      showSuccess(`${config.singular} ${modal === 'edit' ? 'updated' : 'created'} successfully.`);
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save record.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveRecord() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(apiPath(`/${resource}/${selected.id}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await response.json()) as { message?: string | string[] };
      if (!response.ok)
        throw new Error(
          messageOf(
            payload.message,
            hardDelete ? 'Unable to delete record.' : 'Unable to archive record.',
          ),
        );
      setModal(null);
      setSelected(null);
      showSuccess(`${config.singular} ${hardDelete ? 'deleted' : 'archived'} successfully.`);
      await loadRecords();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : hardDelete
            ? 'Unable to delete record.'
            : 'Unable to archive record.',
      );
    } finally {
      setSaving(false);
    }
  }

  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <div className="master-actions">
            <button className="secondary-action" disabled title="CSV/Excel import is planned">
              <FileSpreadsheet size={16} /> Import
            </button>
            <button className="primary-action" onClick={() => openModal('create')}>
              <Plus size={16} /> Add {config.singular}
            </button>
          </div>
        }
      />
      {success && (
        <div className="toast-success" role="status">
          {success}
          <button onClick={() => setSuccess('')}>
            <X size={15} />
          </button>
        </div>
      )}
      <section className="master-panel">
        <div className="master-toolbar">
          <form onSubmit={submitSearch}>
            <label>
              <Search size={16} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${config.title.toLowerCase()}…`}
              />
            </label>
          </form>
          <div className="master-filters">
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setMeta((current) => ({ ...current, page: 1 }));
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              aria-label="Rows per page"
              value={meta.limit}
              onChange={(event) =>
                setMeta((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))
              }
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>
        </div>
        {error && !modal && (
          <div className="master-alert" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="master-loading">
            <span />
            <span />
            <span />
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            hasFilters={Boolean(search || status)}
            singular={config.singular}
            title={config.title}
            onCreate={() => openModal('create')}
          />
        ) : (
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <SortableHead label="Name" field="name" meta={meta} onSort={changeSort} />
                  <SortableHead label="Code" field="code" meta={meta} onSort={changeSort} />
                  {hasExtra(config, 'mapIcon') && <th>Map icon</th>}
                  {'parentLabel' in config && <th>{config.parentLabel}</th>}
                  <SortableHead label="Status" field="status" meta={meta} onSort={changeSort} />
                  <SortableHead label="Order" field="sortOrder" meta={meta} onSort={changeSort} />
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.name}</strong>
                      <small>{record.description || 'No description'}</small>
                    </td>
                    <td>
                      <code>{record.code}</code>
                    </td>
                    {hasExtra(config, 'mapIcon') && (
                      <td>
                        {vehicleTypeIconUrl(record) ? <Image className="vehicle-type-table-icon" src={vehicleTypeIconUrl(record)} alt={`${record.name} map icon`} width={68} height={68} unoptimized /> : <span className="no-vehicle-type-icon">No icon</span>}
                      </td>
                    )}
                    {'parentLabel' in config && (
                      <td>{record.directorate?.name ?? record.department?.name ?? '—'}</td>
                    )}
                    <td>
                      <span className={`record-status ${record.status.toLowerCase()}`}>
                        {record.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{record.sortOrder}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          onClick={() => openModal('view', record)}
                          aria-label={`View ${record.name}`}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openModal('edit', record)}
                          aria-label={`Edit ${record.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          disabled={(!hardDelete && record.status === 'INACTIVE') || record.isSystemRole}
                          onClick={() => openModal('archive', record)}
                          aria-label={`${hardDelete ? 'Delete' : 'Archive'} ${record.name}`}
                        >
                          {hardDelete ? <Trash2 size={15} /> : <Archive size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="master-pagination">
          <span>
            Showing {from}–{to} of {meta.total}
          </span>
          <div>
            <button
              disabled={meta.page <= 1 || loading}
              onClick={() => setMeta((current) => ({ ...current, page: current.page - 1 }))}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span>
              Page {meta.page} of {Math.max(meta.totalPages, 1)}
            </span>
            <button
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => setMeta((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </section>
      {(modal === 'create' || modal === 'edit') && (
        <RecordFormModal
          config={config}
          record={selected}
          parents={parents}
          saving={saving}
          error={error}
          onClose={() => setModal(null)}
          onSubmit={saveRecord}
        />
      )}
      {modal === 'view' && selected && (
        <DetailsModal config={config} record={selected} onClose={() => setModal(null)} />
      )}
      {modal === 'archive' && selected && (
        <ConfirmArchive
          config={config}
          record={selected}
          saving={saving}
          error={error}
          hardDelete={hardDelete}
          onClose={() => setModal(null)}
          onConfirm={() => void archiveRecord()}
        />
      )}
    </>
  );
}

function vehicleTypeIconUrl(record: RecordItem) {
  if (record.mapIconMimeType) return `/api/vehicle-types/${record.id}/map-icon`;
  return record.mapIcon ?? '';
}

function SortableHead({
  label,
  field,
  meta,
  onSort,
}: {
  label: string;
  field: SortField;
  meta: Meta;
  onSort: (field: SortField) => void;
}) {
  const active = meta.sortBy === field;
  return (
    <th>
      <button className={active ? 'active' : ''} onClick={() => onSort(field)}>
        {label}
        {active ? meta.sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : null}
      </button>
    </th>
  );
}
function EmptyState({
  hasFilters,
  singular,
  title,
  onCreate,
}: {
  hasFilters: boolean;
  singular: string;
  title: string;
  onCreate: () => void;
}) {
  return (
    <div className="master-empty">
      <div>
        <FileSpreadsheet size={26} />
      </div>
      <h2>{hasFilters ? 'No matching records' : `No ${title.toLowerCase()} yet`}</h2>
      <p>
        {hasFilters
          ? 'Change or clear the search and status filters.'
          : `Add the first ${singular.toLowerCase()} to make it available throughout the system.`}
      </p>
      {!hasFilters && (
        <button className="primary-action" onClick={onCreate}>
          <Plus size={16} /> Add {singular}
        </button>
      )}
    </div>
  );
}

function RecordFormModal({
  config,
  record,
  parents,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  config: Config;
  record: RecordItem | null;
  parents: RecordItem[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalShell
      title={record ? `Edit ${record.name}` : `Add ${config.singular}`}
      eyebrow={record ? 'Edit record' : 'New record'}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <div className="master-form-grid">
          <FormField label="Name" name="name" defaultValue={record?.name} required />
          <FormField label="Code" name="code" defaultValue={record?.code} required />
          {'parentResource' in config && (
            <label className="master-field full">
              <span>{config.parentLabel}</span>
              <select
                name={config.parentField}
                defaultValue={record?.[config.parentField] ?? ''}
                required
              >
                <option value="" disabled>
                  Select {config.parentLabel.toLowerCase()}
                </option>
                {parents.map((parent) => (
                  <option value={parent.id} key={parent.id}>
                    {parent.name} ({parent.code})
                  </option>
                ))}
              </select>
              {parents.length === 0 && (
                <small>Add an active {config.parentLabel.toLowerCase()} first.</small>
              )}
            </label>
          )}
          {hasExtra(config, 'address') && (
            <>
              <FormField label="Address" name="address" defaultValue={record?.address ?? ''} full />
              <FormField label="State" name="state" defaultValue={record?.state ?? ''} />
            </>
          )}
          {hasExtra(config, 'passengerCapacity') && (
            <FormField
              label="Passenger Capacity"
              name="passengerCapacity"
              type="number"
              min={1}
              defaultValue={record?.passengerCapacity ?? ''}
            />
          )}
          {hasExtra(config, 'mapIcon') && (
            <label className="master-field">
              <span>Upload Map Icon</span>
              <input name="mapIconFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              <small>Choose an image from File Explorer. PNG, JPEG, WebP, or SVG; maximum 2 MB. It will be used for every live vehicle of this type.</small>
            </label>
          )}
          <label className="master-field">
            <span>Status</span>
            <select name="status" defaultValue={record?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <FormField
            label="Sort Order"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={record?.sortOrder ?? 0}
          />
          <label className="master-field full">
            <span>Description</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={record?.description ?? ''}
              maxLength={1000}
            />
          </label>
        </div>
        {error && <div className="master-alert modal-alert">{error}</div>}
        <footer>
          <button type="button" className="secondary-action" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Saving…' : 'Save record'}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
function DetailsModal({
  config,
  record,
  onClose,
}: {
  config: Config;
  record: RecordItem;
  onClose: () => void;
}) {
  return (
    <ModalShell title={record.name} eyebrow={`${config.singular} details`} onClose={onClose}>
      <dl className="details-grid">
        <Detail label="Code" value={record.code} />
        <Detail label="Status" value={record.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
        {'parentLabel' in config && (
          <Detail
            label={config.parentLabel}
            value={record.directorate?.name ?? record.department?.name ?? '—'}
          />
        )}
        <Detail label="Sort order" value={String(record.sortOrder)} />
        {record.address && <Detail label="Address" value={record.address} />}
        {record.state && <Detail label="State" value={record.state} />}
        {record.passengerCapacity && (
          <Detail label="Passenger capacity" value={String(record.passengerCapacity)} />
        )}
        <Detail label="Description" value={record.description || 'No description'} full />
        <Detail label="Created" value={new Date(record.createdAt).toLocaleString()} />
        <Detail label="Last updated" value={new Date(record.updatedAt).toLocaleString()} />
      </dl>
      <footer className="details-footer">
        <button className="primary-action" onClick={onClose}>
          Close
        </button>
      </footer>
    </ModalShell>
  );
}
function ConfirmArchive({
  config,
  record,
  saving,
  error,
  hardDelete,
  onClose,
  onConfirm,
}: {
  config: Config;
  record: RecordItem;
  saving: boolean;
  error: string;
  hardDelete: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      title={`${hardDelete ? 'Delete' : 'Archive'} ${record.name}?`}
      eyebrow="Confirmation required"
      onClose={onClose}
    >
      <div className="archive-copy">
        <div>
          {hardDelete ? <Trash2 size={24} /> : <Archive size={24} />}
        </div>
        {hardDelete ? (
          <p>
            This {config.singular.toLowerCase()} will be permanently deleted. It can only be
            deleted if no users, vehicles, drivers, or requests are using it.
          </p>
        ) : (
          <p>
            This {config.singular.toLowerCase()} will become inactive and will no longer appear in
            operational dropdowns. Existing historical references remain intact.
          </p>
        )}
      </div>
      {error && <div className="master-alert modal-alert">{error}</div>}
      <footer className="confirmation-footer">
        <button className="secondary-action" onClick={onClose}>
          Cancel
        </button>
        {hardDelete && (
          <button className="danger-action" disabled={saving} onClick={onConfirm}>
            {saving ? 'Deleting...' : 'Delete record'}
          </button>
        )}
        <button className="danger-action" disabled={saving} onClick={onConfirm} hidden={hardDelete}>
          {saving ? 'Archiving…' : 'Archive record'}
        </button>
      </footer>
    </ModalShell>
  );
}
function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="master-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="master-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-modal-title"
      >
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2 id="master-modal-title">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Detail({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'full' : ''}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function FormField({
  label,
  name,
  defaultValue,
  type = 'text',
  min,
  required = false,
  full = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: 'text' | 'number';
  min?: number;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`master-field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      <input name={name} type={type} min={min} defaultValue={defaultValue} required={required} />
    </label>
  );
}
function hasExtra(config: Config, field: string) {
  return 'extraFields' in config && (config.extraFields as readonly string[]).includes(field);
}
function messageOf(message: string | string[] | undefined, fallback: string) {
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}
