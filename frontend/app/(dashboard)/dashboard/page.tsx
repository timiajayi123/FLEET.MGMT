'use client';
import { PageHeader } from '@/components/page-header';
import { apiMessage, readApiJson } from '@/lib/api-response';
import { Activity, ArrowUpRight, CheckCircle2, Clock3, ClipboardList, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
type Data = {
  metrics: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    activeUsers: number;
  };
  activity: { date: string; count: number }[];
  approvalQueue: {
    id: string;
    requestNumber: string;
    staffName: string;
    destination: string;
    createdAt: string;
  }[];
};
export default function DashboardPage() {
  const [days, setDays] = useState(30),
    [data, setData] = useState<Data | null>(null),
    [userName, setUserName] = useState(''),
    [error, setError] = useState('');
  const load = useCallback(
    () =>
      fetch(`/api/dashboard?days=${days}`)
        .then(async (r) => {
          const p = await readApiJson<Data>(r, 'Unable to load dashboard.');
          if (!r.ok) throw new Error(apiMessage(p.message, 'Unable to load dashboard.'));
          setData(p);
        })
        .catch((e) => setError(e.message)),
    [days],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => setUserName(payload?.user?.staffName?.toUpperCase() ?? ''))
      .catch(() => undefined);
  }, []);
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
      label: 'Approved requests',
      value: data?.metrics.approvedRequests ?? 0,
      note: 'Approved pool requests',
      icon: CheckCircle2,
      tone: 'blue',
    },
    {
      label: 'Active users',
      value: data?.metrics.activeUsers ?? 0,
      note: 'Enabled staff accounts',
      icon: Users,
      tone: 'purple',
    },
  ];
  const max = Math.max(1, ...(data?.activity.map((x) => x.count) ?? []));
  return (
    <>
      <PageHeader
        title={userName ? `WELCOME, ${userName}` : 'WELCOME'}
        description="A database-backed view of requests and user activity."
        actions={<span className="date-chip">Live operational data</span>}
      />
      {error && <div className="master-alert">{error}</div>}
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
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Fleet activity</h2>
              <p>Pool vehicle requests submitted over time.</p>
            </div>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          {data?.activity.some((x) => x.count > 0) ? (
            <>
              <div className="chart-placeholder">
                {data.activity.map((x) => (
                  <span
                    key={x.date}
                    title={`${x.date}: ${x.count}`}
                    style={{ height: `${Math.max(4, (x.count / max) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="chart-axis">
                <span>{data.activity[0]?.date}</span>
                <span>{data.activity.at(-1)?.date}</span>
              </div>
            </>
          ) : (
            <div className="empty-compact">
              <Activity size={28} />
              <strong>No request activity yet</strong>
              <span>The graph will populate when requests are submitted.</span>
            </div>
          )}
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Approval queue</h2>
              <p>Requests requiring attention.</p>
            </div>
          </div>
          {data?.approvalQueue.length ? (
            <div className="notification-list">
              {data.approvalQueue.map((x) => (
                <div className="notification-item" key={x.id}>
                  <span>
                    <strong>{x.requestNumber}</strong>
                    <small>
                      {x.staffName} · {x.destination}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-compact">
              <CheckCircle2 size={28} />
              <strong>No pending requests</strong>
              <span>New pending approvals will appear here.</span>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
