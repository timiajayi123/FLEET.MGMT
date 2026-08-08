'use client';

import { PageHeader } from '@/components/page-header';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';
import { DriverTripDashboard } from '@/components/driver-trip-dashboard';
import { apiMessage, readApiJson } from '@/lib/api-response';
import {
  countCurrentPermanentAllocations,
  type AllocationForCount,
} from '@/lib/allocation-count';
import {
  ArrowUpRight,
  CarFront,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Navigation,
  Route,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type User = { staffName: string; role: { code: string; name: string } };
type StaffRequest = {
  id: string;
  requestNumber: string;
  destination: string;
  purposeOfTrip: string;
  status: string;
  createdAt: string;
  allocations: {
    status: string;
    driver: { staffName: string; employeeId: string; phone: string };
    vehicle: { registrationNumber: string; manufacturer: string; model: string };
  }[];
};
type DashboardData = {
  role: 'ADMIN' | 'STAFF' | 'DRIVER';
  metrics: Record<string, number>;
  activity: { date: string; count: number }[];
  approvalQueue: {
    id: string;
    requestNumber: string;
    staffName: string;
    destination: string;
    createdAt: string;
  }[];
  myRequests?: StaffRequest[];
  pendingRating?: {
    id: string;
    endedAt?: string;
    driver: { id: string; staffName: string };
    vehicle: { registrationNumber: string };
    request?: { requestNumber: string; destination: string };
  } | null;
  currentAssignment?: {
    id: string;
    status: string;
    startAt: string;
    expectedEndAt: string;
    purpose: string;
    destination?: string;
    vehicle: { registrationNumber: string; manufacturer: string; model: string };
    request?: { requestNumber: string; staffName: string; destination: string };
    trip?: { status: string };
  } | null;
  recentTrips?: {
    id: string;
    status: string;
    calculatedDistance?: number;
    startedAt?: string;
    endedAt?: string;
    vehicle: { registrationNumber: string; manufacturer: string; model: string };
    request?: { requestNumber: string; staffName: string; destination: string };
    allocation: { purpose: string; destination?: string };
  }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      fetch('/api/dashboard?days=30', { cache: 'no-store' })
        .then(async (r) => {
          const p = await readApiJson<DashboardData>(r, 'Unable to load dashboard.');
          if (!r.ok) throw new Error(apiMessage(p.message, 'Unable to load dashboard.'));
          if (p.role === 'ADMIN') {
            const allocationResponse = await fetch('/api/vehicle-allocations', {
              cache: 'no-store',
            });
            if (allocationResponse.ok) {
              const allocationPayload = (await allocationResponse.json()) as {
                data?: AllocationForCount[];
              };
              p.metrics = {
                ...p.metrics,
                activeAllocations: countCurrentPermanentAllocations(
                  allocationPayload.data ?? [],
                ),
              };
            }
          }
          setData(p);
        })
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => setUser(payload?.user ?? null))
      .catch(() => undefined);
  }, []);

  const title = user?.staffName ? `WELCOME, ${user.staffName.toUpperCase()}` : 'WELCOME';
  const roleCode = user?.role.code;

  return (
    <section className="dashboard-workspace">
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
      ) : data?.role === 'ADMIN' ? (
        <AdminDashboard data={data} />
      ) : (
        <section className="panel">
          <p>Loading your dashboard…</p>
        </section>
      )}
    </section>
  );
}

function AdminDashboard({ data }: { data: DashboardData | null }) {
  const metrics = [
    {
      label: 'Total requests',
      value: data?.metrics.totalRequests ?? 0,
      note: 'All submitted requests',
      icon: ClipboardList,
      tone: 'green',
    },
    {
      label: 'Pending requests',
      value: data?.metrics.pendingRequests ?? 0,
      note: 'Awaiting approval',
      icon: Clock3,
      tone: 'amber',
    },
    {
      label: 'Active allocations',
      value: data?.metrics.activeAllocations ?? 0,
      note: 'Current permanent assignments',
      icon: CarFront,
      tone: 'blue',
    },
    {
      label: 'Completed trips',
      value: data?.metrics.completedTrips ?? 0,
      note: 'Finished GPS trips',
      icon: Route,
      tone: 'purple',
    },
  ];
  return (
    <>
      <MetricGrid metrics={metrics} />
      <AnalyticsDashboard embedded />
      <ApprovalQueue data={data} />
    </>
  );
}

function StaffDashboard({ data }: { data: DashboardData }) {
  const actionableRequest = useMemo(
    () =>
      data.myRequests?.find((request) => ['APPROVED', 'ALLOCATED'].includes(request.status)) ??
      null,
    [data.myRequests],
  );
  const [visibleRequestId, setVisibleRequestId] = useState<string | null>(null);
  const [ratingTrip, setRatingTrip] = useState(data.pendingRating ?? null);

  useEffect(() => {
    if (!actionableRequest) {
      queueMicrotask(() => setVisibleRequestId(null));
      return;
    }
    const key = `staff-request-modal:${actionableRequest.id}:${actionableRequest.status}`;
    if (window.localStorage.getItem(key)) {
      queueMicrotask(() => setVisibleRequestId(null));
      return;
    }
    queueMicrotask(() => setVisibleRequestId(actionableRequest.id));
  }, [actionableRequest]);

  function dismissRequestModal() {
    if (actionableRequest) {
      window.localStorage.setItem(
        `staff-request-modal:${actionableRequest.id}:${actionableRequest.status}`,
        'dismissed',
      );
    }
    setVisibleRequestId(null);
  }

  const currentTransport =
    data.myRequests?.find((request) => request.status === 'ALLOCATED' && request.allocations[0]) ??
    null;
  const latestRequest = currentTransport ?? data.myRequests?.[0] ?? null;
  const approvedByFleet =
    (data.metrics.approvedRequests ?? 0) +
    (data.metrics.allocatedRequests ?? 0) +
    (data.metrics.completedRequests ?? 0);
  const metrics = [
    {
      label: 'My requests',
      value: data.metrics.totalRequests ?? 0,
      note: 'Requests you submitted',
      icon: ClipboardList,
      tone: 'green',
    },
    {
      label: 'Approved by fleet',
      value: approvedByFleet,
      note: 'Approved or assigned',
      icon: CheckCircle2,
      tone: 'blue',
    },
    {
      label: 'Trips completed',
      value: data.metrics.completedRequests ?? 0,
      note: 'Finished trips',
      icon: Route,
      tone: 'purple',
    },
  ];

  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>{currentTransport ? 'Current transport' : 'Latest request'}</h2>
              <p>
                {currentTransport
                  ? 'Your driver and vehicle details.'
                  : 'Your latest vehicle request.'}
              </p>
            </div>
          </div>
          {latestRequest ? (
            <StaffRequestUpdate request={latestRequest} />
          ) : (
            <Empty
              icon={<ClipboardList size={28} />}
              title="No request yet"
              text="Submit a vehicle request when you need official transport."
            />
          )}
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>My requests</h2>
              <p>See the status of your requests.</p>
            </div>
          </div>
          {data.myRequests?.length ? (
            <div className="notification-list">
              {data.myRequests.map((request) => (
                <div className="notification-item" key={request.id}>
                  <span>
                    <strong>{request.requestNumber}</strong>
                    <small>
                      {staffStatusLabel(request.status)} · {request.destination}
                    </small>
                    {request.allocations[0] && (
                      <small>
                        {request.allocations[0].vehicle.registrationNumber} ·{' '}
                        {request.allocations[0].driver.staffName}
                      </small>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<ClipboardList size={28} />}
              title="No requests yet"
              text="Submit a vehicle request to get started."
            />
          )}
        </article>
      </section>
      {actionableRequest && visibleRequestId === actionableRequest.id && (
        <StaffRequestStatusModal request={actionableRequest} onClose={dismissRequestModal} />
      )}
      {ratingTrip && <DriverRatingModal trip={ratingTrip} onClose={() => setRatingTrip(null)} />}
    </>
  );
}

function DriverRatingModal({
  trip,
  onClose,
}: {
  trip: NonNullable<DashboardData['pendingRating']>;
  onClose: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [likedTrip, setLikedTrip] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stars || likedTrip === null)
      return setError('Select a journey rating and overall experience.');
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const response = await fetch(`/api/driver-ratings/${trip.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stars,
        likedTrip,
        remark: form.get('remark'),
      }),
    });
    setSaving(false);
    if (!response.ok) return setError('Your rating could not be saved. Please try again.');
    onClose();
  }

  return (
    <div className="master-modal-backdrop">
      <section className="driver-rating-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <small>TRIP COMPLETED</small>
            <h2>Rate your driver</h2>
            <p>
              {trip.driver.staffName} · {trip.vehicle.registrationNumber} ·{' '}
              {trip.request?.destination}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <RatingStars label="Driver trip journey rating" value={stars} onChange={setStars} />
          <fieldset>
            <legend>Did you like the trip?</legend>
            <div className="rating-choice">
              <button
                type="button"
                className={likedTrip === true ? 'active' : ''}
                onClick={() => setLikedTrip(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={likedTrip === false ? 'active negative' : ''}
                onClick={() => setLikedTrip(false)}
              >
                No
              </button>
            </div>
          </fieldset>
          <label>
            <span>Remark (optional)</span>
            <textarea
              name="remark"
              rows={3}
              maxLength={1000}
              placeholder="Tell us briefly about the journey"
            />
          </label>
          {error && <p className="driver-rating-error">{error}</p>}
          <footer>
            <button type="button" className="secondary-action" onClick={onClose}>
              Later
            </button>
            <button className="primary-action" disabled={saving}>
              {saving ? 'Saving…' : 'Submit rating'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function RatingStars({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="rating-stars">
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={star <= value ? 'active' : ''}
            onClick={() => onChange(star)}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
          >
            ★
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function StaffRequestUpdate({ request }: { request: StaffRequest }) {
  const allocation = request.allocations[0];
  if (!allocation)
    return (
      <div className="staff-transport-summary">
        <div>
          <strong>{request.requestNumber}</strong>
          <em>{staffStatusLabel(request.status)}</em>
        </div>
        <p>
          <span>Destination</span>
          {request.destination}
        </p>
        <small>A driver and vehicle will appear here after assignment.</small>
      </div>
    );
  return (
    <div className="staff-transport-summary">
      <div>
        <strong>{request.requestNumber}</strong>
        <em>{staffStatusLabel(request.status)}</em>
      </div>
      <p>
        <span>Destination</span>
        {request.destination}
      </p>
      <div className="staff-transport-details">
        <span>
          <small>Driver</small>
          <strong>{allocation.driver.staffName}</strong>
        </span>
        <span>
          <small>Driver ID</small>
          <strong>{allocation.driver.employeeId}</strong>
        </span>
        <span>
          <small>Phone number</small>
          <strong>{allocation.driver.phone}</strong>
        </span>
        <span>
          <small>Vehicle plate</small>
          <strong>{allocation.vehicle.registrationNumber}</strong>
        </span>
        <span>
          <small>Vehicle type</small>
          <strong>{`${allocation.vehicle.manufacturer} ${allocation.vehicle.model}`.trim()}</strong>
        </span>
        <span>
          <small>Assignment</small>
          <strong>{allocation.status.replaceAll('_', ' ')}</strong>
        </span>
      </div>
    </div>
  );
}

function StaffRequestStatusModal({
  request,
  onClose,
}: {
  request: StaffRequest;
  onClose: () => void;
}) {
  const allocation = request.allocations[0];
  const allocated = request.status === 'ALLOCATED' && allocation;
  return (
    <div className="master-modal-backdrop">
      <section
        className="staff-request-status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-request-status-title"
      >
        <button
          className="staff-request-status-close"
          aria-label="Close request status update"
          onClick={onClose}
        >
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
          Request <strong>{request.requestNumber}</strong> for{' '}
          <strong>{request.destination}</strong> is now{' '}
          <strong>{staffStatusLabel(request.status)}</strong>.
        </p>
        {allocated ? (
          <div className="staff-request-status-grid">
            <span>
              <small>Vehicle plate</small>
              <strong>{allocation.vehicle.registrationNumber}</strong>
            </span>
            <span>
              <small>Vehicle type</small>
              <strong>
                {`${allocation.vehicle.manufacturer} ${allocation.vehicle.model}`.trim()}
              </strong>
            </span>
            <span>
              <small>Driver</small>
              <strong>{allocation.driver.staffName}</strong>
            </span>
            <span>
              <small>Driver ID</small>
              <strong>{allocation.driver.employeeId}</strong>
            </span>
            <span>
              <small>Phone number</small>
              <strong>{allocation.driver.phone}</strong>
            </span>
            <span>
              <small>Assignment</small>
              <strong>{allocation.status.replaceAll('_', ' ')}</strong>
            </span>
          </div>
        ) : (
          <div className="modal-alert info">
            Fleet admin has approved the request. Vehicle and driver allocation will appear here
            once assigned.
          </div>
        )}
        <footer>
          <button className="primary-action" onClick={onClose}>
            Okay, got it
          </button>
        </footer>
      </section>
    </div>
  );
}

function DriverDashboard({ data }: { data: DashboardData }) {
  const metrics = [
    {
      label: 'Assignments',
      value: data.metrics.totalAssignments ?? 0,
      note: 'Request-backed allocations',
      icon: ClipboardList,
      tone: 'green',
    },
    {
      label: 'Completed trips',
      value: data.metrics.completedTrips ?? 0,
      note: 'Finished trips',
      icon: CheckCircle2,
      tone: 'blue',
    },
    {
      label: 'Active trips',
      value: data.metrics.activeTrips ?? 0,
      note: 'Currently in progress',
      icon: Navigation,
      tone: 'amber',
    },
    {
      label: 'Distance',
      value: `${(data.metrics.totalDistance ?? 0).toFixed(2)} km`,
      note: 'Recent recorded distance',
      icon: Route,
      tone: 'purple',
    },
  ];
  return (
    <>
      <MetricGrid metrics={metrics} />
      <DriverTripDashboard />
    </>
  );
  /*
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
          {data.recentTrips?.length ? <div className="notification-list">{data.recentTrips.map((trip) => <div className="notification-item" key={trip.id}><span><strong>{trip.vehicle.registrationNumber} · {trip.status.replaceAll('_', ' ')}</strong><small>{trip.request?.requestNumber} · {trip.allocation.destination || trip.request?.destination}</small><small>{(trip.calculatedDistance ?? 0).toFixed(2)} km</small></span></div>)}</div> : <Empty icon={<Route size={28} />} title="No trip history yet" text="Start and complete an assigned trip to populate this section." />}
        </article>
      </section>
    </>
  );
  */
}

function MetricGrid({
  metrics,
}: {
  metrics: {
    label: string;
    value: number | string;
    note: string;
    icon: LucideIcon;
    tone: string;
  }[];
}) {
  return (
    <section className="metric-grid">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <article className="metric-card" key={m.label}>
            <div className={`metric-icon ${m.tone}`}>
              <Icon size={20} />
            </div>
            <div>
              <p>{m.label}</p>
              <strong>{m.value}</strong>
              <small>{m.note}</small>
            </div>
            <ArrowUpRight className="metric-arrow" size={17} />
          </article>
        );
      })}
    </section>
  );
}

/* Replaced by the embedded analytics workspace and ApprovalQueue above.
function DashboardPanels({ data, days, setDays, queueTitle, queueDescription }: { data: DashboardData | null; days: number; setDays: (days: number) => void; queueTitle: string; queueDescription: string }) {
  return <section className="dashboard-grid"><ActivityPanel data={data} days={days} setDays={setDays} title="Fleet Activity Timeline" description="Vehicle request activity over the selected period." /><article className="panel"><div className="panel-heading"><div><h2>{queueTitle}</h2><p>{queueDescription}</p></div></div>{data?.approvalQueue.length ? <div className="notification-list">{data.approvalQueue.map((x) => <div className="notification-item" key={x.id}><span><strong>{x.requestNumber}</strong><small>{x.staffName} · {x.destination}</small></span></div>)}</div> : <Empty icon={<CheckCircle2 size={28} />} title="No pending requests" text="New pending approvals will appear here." />}</article></section>;
}

function ActivityPanel({ data, days, setDays, title, description }: { data: DashboardData | null; days: number; setDays: (days: number) => void; title: string; description: string }) {
  const max = useMemo(() => Math.max(1, ...(data?.activity.map((x) => x.count) ?? [])), [data]);
  return <article className="panel chart-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">This year</option></select></div>{data?.activity.some((x) => x.count > 0) ? <><div className="chart-placeholder">{data.activity.map((x) => <span key={x.date} title={`${x.date}: ${x.count} vehicle request(s)`} aria-label={`${x.date}: ${x.count} vehicle request(s)`} style={{ height: `${Math.max(4, (x.count / max) * 100)}%` }} />)}</div><div className="chart-axis"><span>{data.activity[0]?.date}</span><span>{data.activity.at(-1)?.date}</span></div></> : <Empty icon={<Activity size={28} />} title="No request activity yet" text="The timeline will populate when requests are submitted." />}</article>;
}

function ApprovalQueue({ data }: { data: DashboardData | null }) {
  return <section className="dashboard-grid"><article className="panel"><div className="panel-heading"><div><h2>Approval queue</h2><p>Requests requiring attention.</p></div></div>{data?.approvalQueue.length ? <div className="notification-list">{data.approvalQueue.map((item) => <div className="notification-item" key={item.id}><span><strong>{item.requestNumber}</strong><small>{item.staffName} · {item.destination}</small></span></div>)}</div> : <Empty icon={<CheckCircle2 size={28} />} title="No pending requests" text="New pending approvals will appear here." />}</article></section>;
}

*/
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="empty-compact">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ApprovalQueue({ data }: { data: DashboardData | null }) {
  return (
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <h2>Approval queue</h2>
            <p>Requests requiring attention.</p>
          </div>
        </div>
        {data?.approvalQueue.length ? (
          <div className="notification-list">
            {data.approvalQueue.map((item) => (
              <div className="notification-item" key={item.id}>
                <span>
                  <strong>{item.requestNumber}</strong>
                  <small>
                    {item.staffName} · {item.destination}
                  </small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<CheckCircle2 size={28} />}
            title="No pending requests"
            text="New pending approvals will appear here."
          />
        )}
      </article>
    </section>
  );
}

function staffStatusLabel(status: string) {
  return (
    {
      PENDING_APPROVAL: 'Submitted for review',
      APPROVED: 'Approved',
      ALLOCATED: 'Transport assigned',
      COMPLETED: 'Trip completed',
      REJECTED: 'Rejected',
    }[status] ?? status.replaceAll('_', ' ')
  );
}

function description(roleCode?: string) {
  if (roleCode === 'DRIVER')
    return 'Your approved request-backed assignments, completed trips and live trip status.';
  if (roleCode === 'ST') return 'Your vehicle requests and transport details.';
  return 'Fleet requests, allocations, trips and operational activity.';
}
