'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CarFront,
  CheckCircle2,
  Gauge,
  Radio,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';

type Violation = {
  id: string;
  recordedSpeed: number;
  maximumSpeed: number;
  effectiveSpeedLimit: number;
  excessSpeed: number;
  severity: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  latitude: number;
  longitude: number;
  vehicle: { id: string; registrationNumber: string; manufacturer: string; model: string };
  driver?: { id: string; staffName: string; employeeId: string };
  readings?: Array<{ speed: number; effectiveSpeedLimit: number; recordedAt: string }>;
  audits?: Array<{
    id: string;
    action: string;
    note?: string;
    createdAt: string;
    actor?: { staffName: string };
  }>;
};
type LiveRow = {
  id: string;
  speedKmh: number;
  effectiveSpeedLimit: number;
  limitSource: string;
  state: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  vehicle?: { registrationNumber: string; manufacturer: string; model: string };
  driver: { staffName: string; employeeId: string };
};
type Settings = Record<string, number | boolean | string> & { alertsEnabled: boolean };
type TypeLimit = {
  id: string;
  code: string;
  name: string;
  speedLimit: number | null;
  _count: { vehicles: number };
};
type Dashboard = {
  activeViolations: number;
  violationsToday: number;
  criticalToday: number;
  monitoredVehicles: number;
  complianceRate: number;
  severity: Array<{ severity: string; _count: number }>;
  recent: Violation[];
};

const tabs = ['Settings', 'Overview', 'Live monitoring', 'Violations', 'Reports'] as const;
const numericSettings = [
  ['defaultSpeedLimit', 'Default fleet limit'],
  ['graceSpeed', 'Grace speed'],
  ['minimumViolationDurationSeconds', 'Minimum violation time (seconds)'],
  ['recoveryDurationSeconds', 'Recovery time (seconds)'],
  ['alertCooldownMinutes', 'Alert cooldown (minutes)'],
  ['lowSeverityMaxExcess', 'Low severity maximum'],
  ['mediumSeverityMaxExcess', 'Medium severity maximum'],
  ['highSeverityMaxExcess', 'High severity maximum'],
  ['staleAfterSeconds', 'Offline after (seconds)'],
  ['readingRetentionDays', 'Reading retention (days)'],
] as const;

export function SpeedOverspeedWorkspace() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ status: 'ALL', severity: 'ALL', search: '' });
  const [selected, setSelected] = useState<Violation | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [types, setTypes] = useState<TypeLimit[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, page: String(meta.page), limit: '20' });
      const [dashResponse, liveResponse, violationResponse] = await Promise.all([
        fetch('/api/speed/dashboard', { cache: 'no-store' }),
        fetch('/api/speed/live', { cache: 'no-store' }),
        fetch(`/api/speed/violations?${params}`, { cache: 'no-store' }),
      ]);
      if (!dashResponse.ok || !liveResponse.ok || !violationResponse.ok)
        throw new Error('Speed monitoring data could not be loaded.');
      const [dash, current, incidents] = await Promise.all([
        dashResponse.json(),
        liveResponse.json(),
        violationResponse.json(),
      ]);
      setDashboard(dash.data);
      setLive(current.data ?? []);
      setViolations(incidents.data ?? []);
      setMeta(incidents.meta ?? { page: 1, pages: 1, total: 0 });
    } catch {
      setDashboard(null);
      setLive([]);
      setViolations([]);
      setMeta({ page: 1, pages: 1, total: 0 });
      setMessage(
        'Speed monitoring data could not be loaded. Check that the backend is running and the speed database migration has been applied.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters, meta.page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (tab !== 'Live monitoring') return;
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [tab, load]);
  useEffect(() => {
    if ((tab !== 'Settings' && tab !== 'Overview') || settings) return;
    Promise.all([
      fetch('/api/speed/settings').then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      }),
      fetch('/api/speed/vehicle-types').then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      }),
    ])
      .then(([settingData, typeData]) => {
        setSettings(settingData.data);
        setTypes(typeData.data ?? []);
      })
      .catch(() =>
        setMessage(
          'Speed settings could not be loaded. The speed database migration may still be pending.',
        ),
      );
  }, [tab, settings]);

  async function openViolation(id: string) {
    const response = await fetch(`/api/speed/violations/${id}`, { cache: 'no-store' });
    if (response.ok) setSelected((await response.json()).data);
  }
  async function changeStatus(status: string) {
    if (!selected) return;
    const note =
      status === 'RESOLVED' || status === 'DISMISSED'
        ? window.prompt('Add a resolution note:')
        : undefined;
    if ((status === 'RESOLVED' || status === 'DISMISSED') && !note) return;
    const response = await fetch(`/api/speed/violations/${selected.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Fleet-Success-Message': `Violation ${status.toLowerCase()}.`,
      },
      body: JSON.stringify({ status, note }),
    });
    if (!response.ok) return setMessage('The violation could not be updated.');
    setSelected(null);
    setMessage(`Violation ${status.toLowerCase()}.`);
    void load();
  }
  async function saveSettings() {
    const response = await fetch('/api/speed/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Fleet-Success-Message': 'Speed settings saved.',
      },
      body: JSON.stringify(settings),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        Array.isArray(payload.message)
          ? payload.message.join(' ')
          : payload.message || 'Settings could not be saved.',
      );
    setSettings(payload.data);
    setMessage('Speed policy saved successfully.');
  }
  async function saveType(item: TypeLimit) {
    const response = await fetch(`/api/speed/vehicle-types/${item.id}/limit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Fleet-Success-Message': `${item.name} speed limit saved.`,
      },
      body: JSON.stringify({ speedLimit: item.speedLimit }),
    });
    setMessage(
      response.ok ? `${item.name} speed limit saved.` : 'Vehicle type limit could not be saved.',
    );
  }
  function exportCsv() {
    const rows = [
      ['Vehicle', 'Driver', 'Started', 'Speed', 'Limit', 'Excess', 'Severity', 'Status'],
      ...violations.map((v) => [
        v.vehicle.registrationNumber,
        v.driver?.staffName ?? '',
        v.startedAt,
        v.maximumSpeed,
        v.effectiveSpeedLimit,
        v.excessSpeed,
        v.severity,
        v.status,
      ]),
    ];
    const blob = new Blob(
      [
        rows
          .map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
          .join('\n'),
      ],
      { type: 'text/csv' },
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `speed-violations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const complianceText = useMemo(() => `${dashboard?.complianceRate ?? 100}%`, [dashboard]);
  return (
    <main className="speed-workspace">
      {tab === 'Overview' && settings && (
        <section className="speed-panel speed-overview-guide">
          <header>
            <div>
              <small>SEVERITY GUIDE</small>
              <h2>Overspeed severity ranges</h2>
              <p>Ranges are measured above the vehicle type speed limit.</p>
            </div>
          </header>
          <div className="severity-range-list">
            <div>
              <strong>LOW</strong>
              <span>Up to {settings.lowSeverityMaxExcess} km/h over</span>
            </div>
            <div>
              <strong>MEDIUM</strong>
              <span>
                {Number(settings.lowSeverityMaxExcess) + 1}–
                {Number(settings.mediumSeverityMaxExcess)} km/h over
              </span>
            </div>
            <div>
              <strong>HIGH</strong>
              <span>
                {Number(settings.mediumSeverityMaxExcess) + 1}–
                {Number(settings.highSeverityMaxExcess)} km/h over
              </span>
            </div>
            <div>
              <strong>CRITICAL</strong>
              <span>More than {settings.highSeverityMaxExcess} km/h over</span>
            </div>
          </div>
        </section>
      )}
      <header className="speed-heading">
        <div>
          <h1>Speed & overspeed monitoring</h1>
        </div>
        <button className="secondary-action" onClick={() => void load()}>
          <Radio size={16} /> Refresh live data
        </button>
      </header>
      {message && (
        <div className="speed-notice" role="status">
          {message}
          <button onClick={() => setMessage('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <nav className="speed-tabs" aria-label="Speed monitoring sections">
        {tabs
          .filter((item) => item !== 'Reports')
          .map((item) => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {item === 'Settings' ? 'Speed limits' : item}
            </button>
          ))}
      </nav>
      {loading && !dashboard ? (
        <section className="speed-empty">Loading fleet speed data…</section>
      ) : null}

      {tab === 'Overview' && dashboard && (
        <>
          <section className="speed-kpis">
            <Kpi
              icon={AlertTriangle}
              label="Active violations"
              value={dashboard.activeViolations}
              tone="red"
            />
            <Kpi
              icon={Gauge}
              label="Violations today"
              value={dashboard.violationsToday}
              tone="amber"
            />
            <Kpi icon={ShieldCheck} label="Compliance rate" value={complianceText} tone="green" />
            <Kpi
              icon={CarFront}
              label="Vehicles monitored"
              value={dashboard.monitoredVehicles}
              tone="blue"
            />
          </section>
          <section className="speed-grid">
            <article className="speed-panel">
              <header>
                <div>
                  <small>RISK DISTRIBUTION</small>
                  <h2>Today by severity</h2>
                </div>
              </header>
              <div className="severity-bars">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((name) => {
                  const count =
                    dashboard.severity?.find((item) => item.severity === name)?._count ?? 0;
                  return (
                    <div key={name}>
                      <span>{name}</span>
                      <i>
                        <b style={{ width: `${Math.min(100, count * 14)}%` }} />
                      </i>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="speed-panel">
              <header>
                <div>
                  <small>LATEST ACTIVITY</small>
                  <h2>Recent incidents</h2>
                </div>
              </header>
              <ViolationTable items={dashboard.recent ?? []} compact onOpen={openViolation} />
            </article>
            {settings && (
              <article className="speed-panel speed-severity-overview">
                <header>
                  <div>
                    <small>SEVERITY GUIDE</small>
                    <h2>Overspeed severity ranges</h2>
                    <p>Ranges are measured above the vehicle type speed limit.</p>
                  </div>
                </header>
                <div className="severity-range-list">
                  <div><strong>LOW</strong><span>Up to {settings.lowSeverityMaxExcess} km/h over</span></div>
                  <div><strong>MEDIUM</strong><span>{Number(settings.lowSeverityMaxExcess) + 1}–{Number(settings.mediumSeverityMaxExcess)} km/h over</span></div>
                  <div><strong>HIGH</strong><span>{Number(settings.mediumSeverityMaxExcess) + 1}–{Number(settings.highSeverityMaxExcess)} km/h over</span></div>
                  <div><strong>CRITICAL</strong><span>More than {settings.highSeverityMaxExcess} km/h over</span></div>
                </div>
              </article>
            )}
          </section>
        </>
      )}

      {tab === 'Live monitoring' && (
        <section className="speed-panel">
          <header>
            <div>
              <small>AUTO REFRESH · 15 SECONDS</small>
              <h2>Live fleet speed</h2>
            </div>
            <span className="live-pulse">LIVE</span>
          </header>
          <div className="speed-table-wrap">
            <table className="speed-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Current speed</th>
                  <th>Effective limit</th>
                  <th>Policy source</th>
                  <th>Last update</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.vehicle?.registrationNumber ?? 'Unassigned'}</strong>
                      <small>
                        {row.vehicle?.manufacturer} {row.vehicle?.model}
                      </small>
                    </td>
                    <td>
                      {row.driver.staffName}
                      <small>{row.driver.employeeId}</small>
                    </td>
                    <td className="speed-number">
                      {row.speedKmh.toFixed(1)} <small>km/h</small>
                    </td>
                    <td>{row.effectiveSpeedLimit} km/h</td>
                    <td>{row.limitSource.replace('_', ' ')}</td>
                    <td>{ago(row.recordedAt)}</td>
                    <td>
                      <Badge value={row.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!live.length && (
              <div className="speed-empty">
                No vehicle is currently transmitting an active-trip GPS signal.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'Violations' && (
        <section className="speed-panel">
          <header className="speed-filter-head">
            <div>
              <small>AUDITABLE INCIDENT LOG</small>
              <h2>Overspeed violations</h2>
            </div>
            <div className="speed-filters">
              <input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Vehicle or driver"
              />
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              >
                <option>ALL</option>
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>CRITICAL</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option>ALL</option>
                <option>ACTIVE</option>
                <option>ENDED</option>
                <option>ACKNOWLEDGED</option>
                <option>RESOLVED</option>
                <option>DISMISSED</option>
              </select>
            </div>
          </header>
          <ViolationTable items={violations} onOpen={openViolation} />
          <footer className="speed-pagination">
            <span>
              {meta.total} incident{meta.total === 1 ? '' : 's'}
            </span>
            <div>
              <button
                disabled={meta.page <= 1}
                onClick={() => setMeta({ ...meta, page: meta.page - 1 })}
              >
                Previous
              </button>
              <b>
                {meta.page} / {meta.pages || 1}
              </b>
              <button
                disabled={meta.page >= meta.pages}
                onClick={() => setMeta({ ...meta, page: meta.page + 1 })}
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      )}

      {tab === 'Reports' && (
        <section className="speed-panel speed-report">
          <header>
            <div>
              <small>COMPLIANCE REPORTING</small>
              <h2>Management-ready speed report</h2>
              <p>
                Use the active violation filters, then export exactly the incident rows visible to
                you.
              </p>
            </div>
            <button className="primary-action" onClick={exportCsv}>
              Export filtered CSV
            </button>
          </header>
          <div className="speed-report-cards">
            <div>
              <strong>{meta.total}</strong>
              <span>Filtered incidents</span>
            </div>
            <div>
              <strong>{dashboard?.criticalToday ?? 0}</strong>
              <span>Critical today</span>
            </div>
            <div>
              <strong>{complianceText}</strong>
              <span>GPS-reading compliance</span>
            </div>
          </div>
          <p className="speed-method">
            Compliance is calculated from valid, non-stale GPS speed readings received today. Driver
            safety scores start at 100 and deduct severity weights plus a duration penalty.
          </p>
        </section>
      )}

      {tab === 'Settings' && settings && (
        <div className="speed-settings-grid">
          <section className="speed-panel">
            <header>
              <div>
                <small>GLOBAL FLEET POLICY</small>
                <h2>Detection and alert settings</h2>
              </div>
            </header>
            <form
              className="speed-settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void saveSettings();
              }}
            >
              {numericSettings.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={String(settings[key] ?? '')}
                    onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
              <label className="speed-checkbox">
                <input
                  type="checkbox"
                  checked={settings.alertsEnabled}
                  onChange={(e) => setSettings({ ...settings, alertsEnabled: e.target.checked })}
                />
                <span>Send live alerts when a violation starts or escalates</span>
              </label>
              <button className="primary-action">Save fleet policy</button>
            </form>
          </section>
          <section className="speed-panel">
            <header>
              <div>
                <h2>Vehicle type limits</h2>
              </div>
            </header>
            <div className="type-limit-list">
              {types.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder={`Global ${settings.defaultSpeedLimit}`}
                    value={item.speedLimit ?? ''}
                    onChange={(e) =>
                      setTypes(
                        types.map((type) =>
                          type.id === item.id
                            ? {
                                ...type,
                                speedLimit: e.target.value ? Number(e.target.value) : null,
                              }
                            : type,
                        ),
                      )
                    }
                  />
                  <button onClick={() => void saveType(item)}>Save</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {selected && (
        <div
          className="master-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <article className="speed-detail-modal">
            <header>
              <div>
                <small>VIOLATION DETAILS</small>
                <h2>{selected.vehicle.registrationNumber}</h2>
                <p>
                  {selected.driver?.staffName ?? 'No driver'} ·{' '}
                  {new Date(selected.startedAt).toLocaleString()}
                </p>
              </div>
              <button aria-label="Close" onClick={() => setSelected(null)}>
                <X />
              </button>
            </header>
            <section className="speed-detail-grid">
              <Detail label="Maximum speed" value={`${selected.maximumSpeed.toFixed(1)} km/h`} />
              <Detail label="Effective limit" value={`${selected.effectiveSpeedLimit} km/h`} />
              <Detail label="Excess speed" value={`+${selected.excessSpeed.toFixed(1)} km/h`} />
              <Detail label="Duration" value={duration(selected.durationSeconds)} />
              <Detail label="Severity" value={selected.severity} />
              <Detail label="Status" value={selected.status} />
              <Detail
                label="Coordinates"
                value={`${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
              />
              <Detail
                label="Vehicle"
                value={`${selected.vehicle.manufacturer} ${selected.vehicle.model}`}
              />
            </section>
            <SpeedChart readings={selected.readings ?? []} />
            {selected.audits?.length ? (
              <section className="speed-audit">
                <h3>Audit trail</h3>
                {selected.audits.map((audit) => (
                  <p key={audit.id}>
                    <CheckCircle2 size={15} />
                    <span>
                      <strong>{audit.action.replace('_', ' ')}</strong>
                      <small>
                        {audit.actor?.staffName ?? 'System'} ·{' '}
                        {new Date(audit.createdAt).toLocaleString()}
                        {audit.note ? ` · ${audit.note}` : ''}
                      </small>
                    </span>
                  </p>
                ))}
              </section>
            ) : null}
            <footer>
              <button onClick={() => setSelected(null)}>Close</button>
              {selected.status === 'ACTIVE' && (
                <button onClick={() => void changeStatus('ACKNOWLEDGED')}>Acknowledge</button>
              )}
              <button className="danger-action" onClick={() => void changeStatus('DISMISSED')}>
                Dismiss
              </button>
              <button className="primary-action" onClick={() => void changeStatus('RESOLVED')}>
                Resolve incident
              </button>
            </footer>
          </article>
        </div>
      )}
    </main>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <article className={`speed-kpi ${tone}`}>
      <span>
        <Icon size={21} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function Badge({ value }: { value: string }) {
  return <span className={`speed-badge ${value.toLowerCase()}`}>{value.replace('_', ' ')}</span>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function ViolationTable({
  items,
  onOpen,
  compact = false,
}: {
  items: Violation[];
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="speed-table-wrap">
      <table className="speed-table">
        <thead>
          <tr>
            <th>Vehicle</th>
            {!compact && <th>Driver</th>}
            <th>Speed / limit</th>
            <th>Started</th>
            <th>Severity</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td>
                <strong>{v.vehicle.registrationNumber}</strong>
                <small>
                  {v.vehicle.manufacturer} {v.vehicle.model}
                </small>
              </td>
              {!compact && (
                <td>
                  {v.driver?.staffName ?? 'Not assigned'}
                  <small>{v.driver?.employeeId}</small>
                </td>
              )}
              <td>
                <strong>{v.maximumSpeed.toFixed(1)}</strong> / {v.effectiveSpeedLimit} km/h
              </td>
              <td>{new Date(v.startedAt).toLocaleString()}</td>
              <td>
                <Badge value={v.severity} />
              </td>
              <td>
                <Badge value={v.status} />
              </td>
              <td>
                <button className="table-view-action" onClick={() => void onOpen(v.id)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <div className="speed-empty">No speed violations match these filters.</div>}
    </div>
  );
}
function SpeedChart({
  readings,
}: {
  readings: Array<{ speed: number; effectiveSpeedLimit: number; recordedAt: string }>;
}) {
  if (!readings.length)
    return (
      <section className="speed-chart">
        <h3>Incident speed trace</h3>
        <p>No retained GPS readings are available for this period.</p>
      </section>
    );
  const max = Math.max(...readings.map((r) => Math.max(r.speed, r.effectiveSpeedLimit)), 1);
  const points = readings
    .map((r, i) => `${(i / Math.max(1, readings.length - 1)) * 100},${100 - (r.speed / max) * 90}`)
    .join(' ');
  const limit = 100 - (readings[0].effectiveSpeedLimit / max) * 90;
  return (
    <section className="speed-chart">
      <h3>Incident speed trace</h3>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Speed over time">
        <line x1="0" y1={limit} x2="100" y2={limit} />
        <polyline points={points} />
      </svg>
      <footer>
        <span>— Speed</span>
        <span>-- Effective limit</span>
      </footer>
    </section>
  );
}
function duration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return mins ? `${mins}m ${seconds % 60}s` : `${seconds}s`;
}
function ago(value: string) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  return seconds < 60 ? `${Math.max(0, seconds)}s ago` : `${Math.round(seconds / 60)}m ago`;
}
