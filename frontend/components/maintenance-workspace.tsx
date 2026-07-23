'use client';

import { CheckCircle2, ClipboardList, Wrench, XCircle } from 'lucide-react';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from './page-header';

type Vehicle = { id: string; registrationNumber: string; manufacturer: string; model: string; status: string; vehicleType?: { name: string } | null };
type MaintenanceRequest = { id: string; issueType: string; issueDescription: string; issueOccurredAt: string; status: string; evidenceMimeType?: string | null; serviceability?: string | null; adminRemark?: string | null; reviewedAt?: string | null; vehicle: Vehicle; reportedBy: { staffName: string; employeeId: string }; reviewedBy?: { staffName: string } | null; createdAt: string };

export function MaintenanceWorkspace() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const [requestResponse, vehicleResponse] = await Promise.all([
        fetch('/api/maintenance', { cache: 'no-store' }),
        fetch('/api/maintenance/vehicles', { cache: 'no-store' }),
      ]);
      const requestPayload = await requestResponse.json();
      const vehiclePayload = await vehicleResponse.json();
      if (!requestResponse.ok) throw new Error(requestPayload.message || 'Unable to load maintenance requests.');
      if (!vehicleResponse.ok) throw new Error(vehiclePayload.message || 'Unable to load eligible vehicles.');
      setRequests(requestPayload.data ?? []);
      setVehicles(vehiclePayload.data ?? []);
      setCanReview(Boolean(requestPayload.canReview));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load maintenance.');
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const pending = useMemo(() => requests.filter((request) => request.status === 'PENDING_REVIEW'), [requests]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch('/api/maintenance', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to submit maintenance request.');
      form.reset();
      setMessage('Maintenance request submitted for fleet review.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit maintenance request.');
    } finally { setSaving(false); }
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/maintenance/${selected.id}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to review maintenance request.');
      setSelected(null);
      setMessage('Vehicle maintenance decision saved.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to review maintenance request.');
    } finally { setSaving(false); }
  }

  return <>
    <PageHeader title="Vehicle Maintenance" description={canReview === true ? 'Review driver-submitted vehicle fault reports and record the fleet maintenance decision.' : 'Report a fault for a vehicle allocated to you. Fleet administrators will review it.'} />
    <section className="maintenance-layout">
      {canReview === false && <article className="panel maintenance-form-panel">
        <div className="panel-heading"><div><h2>Report a vehicle issue</h2><p>Select the vehicle, fault type, date and a clear description.</p></div><Wrench size={20} /></div>
        <form className="maintenance-form" onSubmit={submit}>
          <label><span>Vehicle</span><select name="vehicleId" required defaultValue=""><option value="" disabled>Select vehicle</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.registrationNumber} - {vehicle.manufacturer} {vehicle.model}{vehicle.vehicleType?.name ? ` (${vehicle.vehicleType.name})` : ''}</option>)}</select></label>
          <label><span>Issue type</span><select name="issueType" required defaultValue=""><option value="" disabled>Select issue type</option><option>Mechanical</option><option>Electrical</option><option>Tyres / wheels</option><option>Body / interior</option><option>Safety equipment</option><option>Fluid leak</option><option>Other</option></select></label>
          <label><span>Date issue occurred</span><input name="issueOccurredAt" type="date" required max={new Date().toISOString().slice(0, 10)} /></label>
          <label className="full"><span>Fault description</span><textarea name="issueDescription" required rows={5} maxLength={2000} placeholder="Describe the fault, symptoms, and whether it affects safe use of the vehicle." /></label>
          <label className="full"><span>Fault photo (optional)</span><input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPEG, PNG, or WebP up to 5 MB.</small></label>
          <button className="primary-action" disabled={saving || !vehicles.length}>{saving ? 'Submitting...' : 'Submit maintenance request'}</button>
          {!vehicles.length && <small className="maintenance-note">Drivers can report vehicles that have been allocated to them.</small>}
        </form>
      </article>}
      <article className="panel maintenance-summary">
        <div className="panel-heading"><div><h2>{canReview === true ? 'Fleet maintenance review' : 'My maintenance requests'}</h2><p>{canReview === true ? `${pending.length} request${pending.length === 1 ? '' : 's'} awaiting review.` : 'Your submitted vehicle fault reports.'}</p></div><ClipboardList size={20} /></div>
        {requests.length ? <div className="maintenance-request-list">{requests.map((request) => <article key={request.id}>
          <header><div><strong>{request.vehicle.registrationNumber}</strong><small>{request.vehicle.manufacturer} {request.vehicle.model} - {request.vehicle.vehicleType?.name ?? 'Vehicle type not set'}</small></div><span className={`maintenance-status ${request.status.toLowerCase()}`}>{statusLabel(request.status)}</span></header>
          <dl><div><dt>Issue</dt><dd>{request.issueType}</dd></div><div><dt>Occurred</dt><dd>{new Date(request.issueOccurredAt).toLocaleDateString()}</dd></div><div><dt>Reported by</dt><dd>{request.reportedBy.staffName}</dd></div></dl>
          <p>{request.issueDescription}</p>
          {request.evidenceMimeType && <a className="maintenance-evidence" href={`/api/maintenance/${request.id}/evidence`} target="_blank" rel="noreferrer"><Image src={`/api/maintenance/${request.id}/evidence`} alt={`Fault evidence for ${request.vehicle.registrationNumber}`} width={128} height={96} unoptimized /><span>View uploaded fault photo</span></a>}
          {request.adminRemark && <div className="maintenance-decision"><strong>{request.serviceability === 'SERVICEABLE' ? 'Serviceable - sent for maintenance' : 'Unserviceable - removed from service'}</strong><span>{request.adminRemark}</span>{request.reviewedBy && <small>Reviewed by {request.reviewedBy.staffName}</small>}</div>}
          {canReview === true && request.status === 'PENDING_REVIEW' && <button className="secondary-action" onClick={() => setSelected(request)}>Review request</button>}
        </article>)}</div> : <div className="master-empty"><Wrench size={28} /><h2>{canReview === null ? 'Loading maintenance requests' : 'No maintenance requests'}</h2><p>{canReview === true ? 'Driver-submitted fault reports will appear here for review.' : 'Your submitted vehicle fault reports will appear here.'}</p></div>}
      </article>
    </section>
    {message && <div className="maintenance-toast"><CheckCircle2 size={18} /> {message}</div>}
    {error && <div className="master-alert">{error}</div>}
    {selected && <div className="master-modal-backdrop"><section className="maintenance-review-modal" role="dialog" aria-modal="true">
      <header><div><small>MAINTENANCE REVIEW</small><h2>{selected.vehicle.registrationNumber}</h2></div><button onClick={() => setSelected(null)} aria-label="Close review"><XCircle size={20} /></button></header>
      <p><strong>{selected.issueType}</strong> - {selected.issueDescription}</p>
      {selected.evidenceMimeType && <a className="maintenance-evidence review-evidence" href={`/api/maintenance/${selected.id}/evidence`} target="_blank" rel="noreferrer"><Image src={`/api/maintenance/${selected.id}/evidence`} alt={`Fault evidence for ${selected.vehicle.registrationNumber}`} width={256} height={192} unoptimized /><span>Open full image</span></a>}
      <form onSubmit={review}><label><span>Serviceability decision</span><select name="serviceability" defaultValue="SERVICEABLE" required><option value="SERVICEABLE">Serviceable - send for maintenance</option><option value="UNSERVICEABLE">Unserviceable - remove from service</option></select></label><label><span>Fleet admin remark</span><textarea name="adminRemark" rows={5} required maxLength={2000} placeholder="Record the assessment, work required, workshop instruction, or reason for removing the vehicle from service." /></label><footer><button type="button" className="secondary-action" onClick={() => setSelected(null)}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? 'Saving...' : 'Save maintenance decision'}</button></footer></form>
    </section></div>}
  </>;
}

function statusLabel(status: string) {
  return { PENDING_REVIEW: 'Pending review', MAINTENANCE_REQUIRED: 'Maintenance required', OUT_OF_SERVICE: 'Out of service' }[status] ?? status.replaceAll('_', ' ');
}
