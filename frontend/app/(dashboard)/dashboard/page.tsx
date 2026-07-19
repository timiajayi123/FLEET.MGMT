'use client';

import { PageHeader } from '@/components/page-header';
import { apiMessage, readApiJson } from '@/lib/api-response';
import { Activity, ArrowUpRight, CarFront, CheckCircle2, Clock3, ClipboardList, MapPin, Navigation, Route, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type User = { staffName: string; role: { code: string; name: string } };
type StaffRequest = {
  id: string;
  requestNumber: string;
  destination: string;
  purposeOfTrip: string;
  status: string;
  createdAt: string;
  allocations: { status: string; driver: { staffName: string }; vehicle: { registrationNumber: string } }[];
};
type DashboardData = {
  role: 'ADMIN' | 'STAFF' | 'DRIVER';
  metrics: Record<string, number>;
  activity: { date: string; count: number }[];
  approvalQueue: { id: string; requestNumber: string; staffName: string; destination: string; createdAt: string }[];
  myRequests?: StaffRequest[];
  currentAssignment?: { id: string; status: string; startAt: string; expectedEndAt: string; purpose: string; destination?: string; vehicle: { registrationNumber: string; manufacturer: string; model: string }; request?: { requestNumber: string; staffName: string; destination: string }; trip?: { status: string } } | null;
  recentTrips?: { id: string; status: string; calculatedDistance?: number; startedAt?: string; endedAt?: string; vehicle: { registrationNumber: string; manufacturer: string; model: string }; request?: { requestNumber: string; staffName: string; destination: string }; allocation: { purpose: string; destination?: string } }[];
};

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      fetch(`/api/dashboard?days=${days}`)
        .then(async (r) => {
          const p = await readApiJson<DashboardData>(r, 'Unable to load dashboard.');
          if (!r.ok) throw new Error(apiMessage(p.message, 'Unable to load dashboard.'));
          setData(p);
        })
        .catch((e) => setError(e.message)),
    [days],
  );

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => setUser(payload?.user ?? null))
      .catch(() => undefined);
  }, []);

  const title = user?.staffName ? `WELCOME, ${user.staffName.toUpperCase()}` : 'WELCOME';
  const roleCode = user?.role.code;

  return (
    <>
      <PageHeader
        title={title}
        description={description(roleCode)}
        actions={<span className="date-chip">{user?.role.name ?? 'Dashboard'}</span>}
      />
      {error && <div className="master-alert">{error}</div>}
      {data?.role === 'DRIVER' ? (
        <DriverDashboard data={data} />
      ) : data?.role === 'STAFF' ? (
        <StaffDashboard data={data} />
      ) : (
        <AdminDashboard data={data} days={days} setDays={setDays} />
      )}
    </>
  );
}

function AdminDashboard({ data, days, setDays }: { data: DashboardData | null; days: number; setDays: (days: number) => void }) {
  const metrics = [
    { label: 'Total requests', value: data?.metrics.totalRequests ?? 0, note: 'All submitted requests', icon: ClipboardList, tone: 'green' },
    { label: 'Pending requests', value: data?.metrics.pendingRequests ?? 0, note: 'Awaiting approval', icon: Clock3, tone: 'amber' },
    { label: 'Active allocations', value: data?.metrics.activeAllocations ?? 0, note: 'Request-backed assignments', icon: CarFront, tone: 'blue' },
    { label: 'Completed trips', value: data?.metrics.completedTrips ?? 0, note: 'Finished GPS trips', icon: Route, tone: 'purple' },
  ];
  return (
    <>
      <MetricGrid metrics={metrics} />
      <DashboardPanels data={data} days={days} setDays={setDays} queueTitle="Approval queue" queueDescription="Requests requiring attention." />
    </>
  );
}

function StaffDashboard({ data }: { data: DashboardData }) {
  const actionableRequest = useMemo(
    () => data.myRequests?.find((request) => ['APPROVED', 'ALLOCATED'].includes(request.status)) ?? null,
    [data.myRequests],
  );
  const [visibleRequestId, setVisibleRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!actionableRequest) {
      setVisibleRequestId(null);
      return;
    }
    const key = `staff-request-modal:${actionableRequest.id}:${actionableRequest.status}`;
    if (window.localStorage.getItem(key)) {
      setVisibleRequestId(null);
      return;
    }
    setVisibleRequestId(actionableRequest.id);
  }, [actionableRequest]);

  function dismissRequestModal() {
    if (actionableRequest) {
      window.localStorage.setItem(`staff-request-modal:${actionableRequest.id}:${actionableRequest.status}`, 'dismissed');
    }
    setVisibleRequestId(null);
  }

  const latestRequest = data.myRequests?.[0] ?? null;
  const approvedByFleet = (data.metrics.approvedRequests ?? 0) + (data.metrics.allocatedRequests ?? 0) + (data.metrics.completedRequests ?? 0);
  const metrics = [
    { label: 'My requests', value: data.metrics.totalRequests ?? 0, note: 'All transport requests submitted by you', icon: ClipboardList, tone: 'green' },
    { label: 'Approved by fleet', value: approvedByFleet, note: 'Approved, assigned, or completed', icon: CheckCircle2, tone: 'blue' },
    { label: 'Trips completed', value: data.metrics.completedRequests ?? 0, note: 'Completed transport trips', icon: Route, tone: 'purple' },
  ];

  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><h2>Latest request update</h2><p>Your most recent transport request.</p></div></div>
          {latestRequest ? (
            <div className="driver-dashboard-assignment">
              <strong>{latestRequest.requestNumber}</strong>
              <span>{staffStatusLabel(latestRequest.status)}</span>
              <small>Destination: {latestRequest.destination}</small>
              {['ALLOCATED', 'COMPLETED'].includes(latestRequest.status) && latestRequest.allocations[0] && (
                <small>Vehicle: {latestRequest.allocations[0].vehicle.registrationNumber}</small>
              )}
              <em>{staffStatusLabel(latestRequest.status)}</em>
            </div>
          ) : (
            <Empty icon={<ClipboardList size={28} />} title="No request yet" text="Submit a vehicle request when you need official transport." />
          )}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h2>My requests</h2><p>Simple status history for your transport requests.</p></div></div>
          {data.myRequests?.length ? (
            <div className="notification-list">
              {data.myRequests.map((request) => (
                <div className="notification-item" key={request.id}>
                  <span>
                    <strong>{request.requestNumber}</strong>
                    <small>{staffStatusLabel(request.status)} · {request.destination}</small>
                    {request.allocations[0] && <small>{request.allocations[0].vehicle.registrationNumber} · {request.allocations[0].driver.staffName}</small>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<ClipboardList size={28} />} title="No requests yet" text="Submit a vehicle request to begin the approval workflow." />
          )}
        </article>
      </section>
      {actionableRequest && visibleRequestId === actionableRequest.id && (
        <StaffRequestStatusModal request={actionableRequest} onClose={dismissRequestModal} />
      )}
    </>
  );
}

function StaffRequestStatusModal({ request, onClose }: { request: StaffRequest; onClose: () => void }) {
  const allocation = request.allocations[0];
  const allocated = request.status === 'ALLOCATED' && allocation;
  return (
    <div className="master-modal-backdrop">
      <section className="staff-request-status-modal" role="dialog" aria-modal="true" aria-labelledby="staff-request-status-title">
        <button className="staff-request-status-close" aria-label="Close request status update" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="staff-request-status-icon">
          <CheckCircle2 size={34} />
        </div>
        <small>VEHICLE REQUEST UPDATE</small>
        <h2 id="staff-request-status-title">
          {allocated ? 'Your transport is ready' : 'Your request has been approved'}
        </h2>
        <p>
          Request <strong>{request.requestNumber}</strong> for <strong>{request.destination}</strong> is now{' '}
          <strong>{staffStatusLabel(request.status)}</strong>.
        </p>
        {allocated ? (
          <div className="staff-request-status-grid">
            <span><small>Vehicle</small><strong>{allocation.vehicle.registrationNumber}</strong></span>
            <span><small>Driver</small><strong>{allocation.driver.staffName}</strong></span>
            <span><small>Assignment</small><strong>{allocation.status.replaceAll('_', ' ')}</strong></span>
          </div>
        ) : (
          <div className="modal-alert info">Fleet admin has approved the request. Vehicle and driver allocation will appear here once assigned.</div>
        )}
        <footer>
          <button className="primary-action" onClick={onClose}>Okay, got it</button>
        </footer>
      </section>
    </div>
  );
}

function DriverDashboard({ data }: { data: DashboardData }) {
  const metrics = [
    { label: 'Assignments', value: data.metrics.totalAssignments ?? 0, note: 'Request-backed allocations', icon: ClipboardList, tone: 'green' },
    { label: 'Completed trips', value: data.metrics.completedTrips ?? 0, note: 'Finished trips', icon: CheckCircle2, tone: 'blue' },
    { label: 'Active trips', value: data.metrics.activeTrips ?? 0, note: 'Currently in progress', icon: Navigation, tone: 'amber' },
    { label: 'Distance', value: `${(data.metrics.totalDistance ?? 0).toFixed(1)} km`, note: 'Recent recorded distance', icon: Route, tone: 'purple' },
  ];
  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><h2>Current assignment</h2><p>Your approved request-backed trip assignment.</p></div></div>
          {data.currentAssignment ? <div className="driver-dashboard-assignment"><strong>{data.currentAssignment.vehicle.registrationNumber}</strong><span>{data.currentAssignment.vehicle.manufacturer} {data.currentAssignment.vehicle.model}</span><small>{data.currentAssignment.request?.requestNumber} · {data.currentAssignment.destination || data.currentAssignment.request?.destination}</small><em>{data.currentAssignment.status.replaceAll('_', ' ')}</em></div> : <Empty icon={<MapPin size={28} />} title="No current assignment" text="Approved vehicle request allocations assigned to you will appear here." />}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h2>Recent trips</h2><p>Your latest completed or active GPS trips.</p></div></div>
          {data.recentTrips?.length ? <div className="notification-list">{data.recentTrips.map((trip) => <div className="notification-item" key={trip.id}><span><strong>{trip.vehicle.registrationNumber} · {trip.status.replaceAll('_', ' ')}</strong><small>{trip.request?.requestNumber} · {trip.allocation.destination || trip.request?.destination}</small><small>{(trip.calculatedDistance ?? 0).toFixed(1)} km</small></span></div>)}</div> : <Empty icon={<Route size={28} />} title="No trip history yet" text="Start and complete an assigned trip to populate this section." />}
        </article>
      </section>
    </>
  );
}

function MetricGrid({ metrics }: { metrics: { label: string; value: number | string; note: string; icon: LucideIcon; tone: string }[] }) {
  return <section className="metric-grid">{metrics.map((m) => { const Icon = m.icon; return <article className="metric-card" key={m.label}><div className={`metric-icon ${m.tone}`}><Icon size={20} /></div><div><p>{m.label}</p><strong>{m.value}</strong><small>{m.note}</small></div><ArrowUpRight className="metric-arrow" size={17} /></article>; })}</section>;
}

function DashboardPanels({ data, days, setDays, queueTitle, queueDescription }: { data: DashboardData | null; days: number; setDays: (days: number) => void; queueTitle: string; queueDescription: string }) {
  return <section className="dashboard-grid"><ActivityPanel data={data} days={days} setDays={setDays} title="Fleet activity" description="Pool vehicle requests submitted over time." /><article className="panel"><div className="panel-heading"><div><h2>{queueTitle}</h2><p>{queueDescription}</p></div></div>{data?.approvalQueue.length ? <div className="notification-list">{data.approvalQueue.map((x) => <div className="notification-item" key={x.id}><span><strong>{x.requestNumber}</strong><small>{x.staffName} · {x.destination}</small></span></div>)}</div> : <Empty icon={<CheckCircle2 size={28} />} title="No pending requests" text="New pending approvals will appear here." />}</article></section>;
}

function ActivityPanel({ data, days, setDays, title, description }: { data: DashboardData | null; days: number; setDays: (days: number) => void; title: string; description: string }) {
  const max = useMemo(() => Math.max(1, ...(data?.activity.map((x) => x.count) ?? [])), [data]);
  return <article className="panel chart-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>{data?.activity.some((x) => x.count > 0) ? <><div className="chart-placeholder">{data.activity.map((x) => <span key={x.date} title={`${x.date}: ${x.count}`} style={{ height: `${Math.max(4, (x.count / max) * 100)}%` }} />)}</div><div className="chart-axis"><span>{data.activity[0]?.date}</span><span>{data.activity.at(-1)?.date}</span></div></> : <Empty icon={<Activity size={28} />} title="No request activity yet" text="The graph will populate when requests are submitted." />}</article>;
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty-compact">{icon}<strong>{title}</strong><span>{text}</span></div>;
}

function staffStatusLabel(status: string) {
  return {
    PENDING_APPROVAL: 'Submitted for review',
    APPROVED: 'Approved',
    ALLOCATED: 'Transport assigned',
    COMPLETED: 'Trip completed',
    REJECTED: 'Rejected',
  }[status] ?? status.replaceAll('_', ' ');
}

function description(roleCode?: string) {
  if (roleCode === 'DRIVER') return 'Your approved request-backed assignments, completed trips and live trip status.';
  if (roleCode === 'ST') return 'Your vehicle request status and transport updates.';
  return 'Fleet requests, allocations, trips and operational activity.';
}
