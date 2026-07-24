'use client';

import { PageHeader } from './page-header';
import { useEffect, useMemo, useState } from 'react';
import { CarFront, ClipboardList, Gauge, Route, Users, type LucideIcon } from 'lucide-react';

type Row = { label: string; value: number };
type ChartPoint = Row & { x: number; y: number };
type Dashboard = { metrics: Record<string, number | null>; activity: { date: string; value: number }[]; driverActivity: { date: string; value: number }[]; distanceActivity: { date: string; value: number }[]; requestStatus: Row[]; tripPurpose: Row[]; requestsByDepartment: Row[]; mostUsedVehicles: Row[]; mostActiveDrivers: Row[] };
type SpeedData = { threshold: number; trend: { recordedAt: string; speed: number }[]; violations: unknown[] };

export function AnalyticsDashboard({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [speed, setSpeed] = useState<SpeedData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));
    const from = new Date();
    from.setDate(from.getDate() - Number(range) + 1);
    const query = `from=${encodeURIComponent(from.toISOString())}`;
    Promise.all([
      fetch(`/api/analytics/dashboard?${query}`, { signal: controller.signal }),
      fetch(`/api/analytics/speed?${query}&threshold=100`, { signal: controller.signal }),
    ])
      .then(async ([dashboardResponse, speedResponse]) => {
        const dashboardBody = await dashboardResponse.json();
        const speedBody = await speedResponse.json();
        if (!dashboardResponse.ok) throw new Error(dashboardBody.message || 'Unable to load analytics.');
        if (!speedResponse.ok) throw new Error(speedBody.message || 'Unable to load speed analytics.');
        return [dashboardBody as Dashboard, speedBody as SpeedData] as const;
      })
      .then(([dashboard, speedData]) => { setData(dashboard); setSpeed(speedData); })
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [range]);

  const metrics = data?.metrics ?? {};
  const cards = [
    { label: 'Vehicles', value: metrics.vehicles, icon: CarFront },
    { label: 'Available', value: metrics.availableVehicles, icon: CarFront },
    { label: 'Requests', value: metrics.requests, icon: ClipboardList },
    { label: 'Completed trips', value: metrics.completedTrips, icon: Route },
    { label: 'Active drivers', value: metrics.activeDrivers, icon: Users },
    { label: 'Distance', value: metrics.distanceTravelled === null || metrics.distanceTravelled === undefined ? '—' : `${Number(metrics.distanceTravelled).toFixed(1)} km`, icon: Gauge },
  ];
  const speedRows = (speed?.trend ?? []).slice(-80).map((row) => ({ label: row.recordedAt, value: row.speed }));
  const filters = <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Analytics date range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">This year</option></select>;
  const activityRows = data ? combineActivityRows(data.activity, data.driverActivity) : [];

  return <section className={embedded ? 'dashboard-analytics-embedded' : undefined}>
    {!embedded && <PageHeader title="Dashboard Analytics" description="Live fleet metrics, trips, vehicle requests and operational trends." actions={filters} />}
    {embedded && <div className="analytics-embedded-heading"><div><h2>Fleet analytics</h2><p>Live request, trip, distance and safety trends.</p></div>{filters}</div>}
    {error && <div className="master-alert">{error}</div>}
    {loading ? <section className="panel"><p>Loading live analytics…</p></section> : !data ? <section className="panel"><p>Analytics could not be loaded.</p></section> : <>
      <section className="analytics-primary-layout">
        <FleetActivityTimeline rows={activityRows} range={range} />
        <section className="panel fleet-analytics-side"><div className="panel-heading"><div><h2>Fleet analytics</h2><p>Current operational totals.</p></div></div><section className="metric-grid fleet-analytics-metrics">{cards.map(({ label, value, icon: Icon }) => <article className="metric-card" key={label}><div className="metric-icon blue"><Icon size={20} /></div><div><p>{label}</p><strong>{value ?? 0}</strong><small>Recorded in fleet data</small></div></article>)}</section></section>
      </section>
      <section className="analytics-chart-grid">
        <LineChart title="Speed and overspeed trend" description={`${speed?.violations.length ?? 0} GPS point(s) exceeded the red 100 km/h guide line. Hover across the chart for a reading.`} rows={speedRows} icon={Gauge} tone="red" threshold={speed?.threshold ?? 100} unit="km/h" />
        <LineChart title="Trip distance trend" description="Distance recorded for completed journeys. Hover across the chart to inspect each trip date." rows={data.distanceActivity.map((row) => ({ label: row.date, value: row.value }))} icon={Route} tone="gold" unit="km" />
      </section>
      <section className="dashboard-grid"><Breakdown title="Request status" rows={data.requestStatus} /><Breakdown title="Trip purpose" rows={data.tripPurpose} /><Breakdown title="Requests by department" rows={data.requestsByDepartment} /><Breakdown title="Most-used vehicles" rows={data.mostUsedVehicles} /><Breakdown title="Most-active drivers" rows={data.mostActiveDrivers} /></section>
    </>}
  </section>;
}

function FleetActivityTimeline({ rows, range }: { rows: Row[]; range: string }) {
  const chart = useMemo(() => timelinePoints(rows), [rows]);
  const [selected, setSelected] = useState<ChartPoint | null>(null);
  const rangeLabel = range === '365' ? 'this year' : `the last ${range} days`;
  return <article className="panel line-chart-panel fleet-activity-timeline">
    <div className="panel-heading"><div><h2>Fleet Activity Timeline</h2><p>Combined vehicle requests and request-backed driver trips over {rangeLabel}.</p></div><ClipboardList size={20} /></div>
    {rows.length ? <>
      <div className="line-chart-summary"><strong>{chart.latest}</strong><span>{chart.max} peak activity</span></div>
      <svg className="activity-timeline-chart" viewBox="0 0 1000 350" role="img" aria-label={`Fleet activity timeline: latest ${chart.latest}, peak ${chart.max}`} preserveAspectRatio="none" onMouseMove={(event) => setSelected(nearestPoint(chart.points, event.clientX - event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().width))} onMouseLeave={() => setSelected(null)}>
        {chart.ticks.map((tick) => <g key={tick.value}><line className="activity-timeline-grid" x1="58" y1={tick.y} x2="978" y2={tick.y} /><text className="activity-timeline-y-label" x="48" y={tick.y + 4} textAnchor="end">{tick.value}</text></g>)}
        {chart.verticalGrid.map((x) => <line className="activity-timeline-grid" key={x} x1={x} y1="24" x2={x} y2="286" />)}
        {chart.points.map((point, index) => (index % chart.labelEvery === 0 || index === chart.points.length - 1) && <text className="activity-timeline-x-label" key={`${point.label}-label`} x={point.x} y="329" textAnchor="middle">{shortDate(point.label)}</text>)}
        <path className="activity-timeline-area" d={`${chart.areaPath} L978 286 L58 286 Z`} />
        <path className="activity-timeline-line" d={chart.smoothPath} />
        {chart.points.map((point) => <circle className="activity-timeline-node" key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="4.5" tabIndex={0} onMouseEnter={() => setSelected(point)} onFocus={() => setSelected(point)} aria-label={`${shortDate(point.label)}: ${point.value} fleet activities`}><title>{`${shortDate(point.label)}: ${point.value} fleet activities`}</title></circle>)}
        {selected && <ChartTooltip point={selected} chartWidth={1000} unit="activities" />}
      </svg>
    </> : <p className="empty-compact">No fleet activity exists for this period.</p>}
  </article>;
}

function LineChart({ title, description, rows, icon: Icon, tone = 'green', threshold, unit = '' }: { title: string; description: string; rows: Row[]; icon: LucideIcon; tone?: 'green' | 'blue' | 'red' | 'gold'; threshold?: number; unit?: string }) {
  const chart = useMemo(() => chartPoints(rows, threshold), [rows, threshold]);
  const [selected, setSelected] = useState<ChartPoint | null>(null);
  return <article className={`panel line-chart-panel ${tone}`}><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><Icon size={19} /></div>{rows.length ? <><div className="line-chart-summary"><strong>{chart.latest}{unit && ` ${unit}`}</strong><span>{chart.max}{unit && ` ${unit}`} peak</span></div><svg className="line-chart" viewBox="0 0 600 190" role="img" aria-label={`${title}: latest ${chart.latest}${unit}, peak ${chart.max}${unit}`} preserveAspectRatio="none" onMouseMove={(event) => setSelected(nearestPoint(chart.points, event.clientX - event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().width))} onMouseLeave={() => setSelected(null)}><path className="line-chart-grid" d="M24 28H584M24 74H584M24 120H584M24 166H584M24 28V166M136 28V166M248 28V166M360 28V166M472 28V166M584 28V166" />{threshold !== undefined && <><path className="line-chart-threshold" d={`M24 ${chart.y(threshold)}H584`} /><text x="580" y={chart.y(threshold) - 5} textAnchor="end">{threshold} {unit}</text></>}<path className="line-chart-area" d={`${chart.path} L584 166 L24 166 Z`} /><path className="line-chart-line" d={chart.path} />{chart.points.map((point) => <circle className="line-chart-node" key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="4" tabIndex={0} onMouseEnter={() => setSelected(point)} onFocus={() => setSelected(point)} aria-label={`${shortDate(point.label)}: ${point.value}${unit ? ` ${unit}` : ''}`}><title>{`${shortDate(point.label)}: ${point.value}${unit ? ` ${unit}` : ''}`}</title></circle>)}{selected && <ChartTooltip point={selected} chartWidth={600} unit={unit} />}</svg><footer><span>{shortDate(rows[0].label)}</span><span>{shortDate(rows.at(-1)?.label ?? '')}</span></footer></> : <p className="empty-compact">No chart data exists for this period.</p>}</article>;
}

function ChartTooltip({ point, chartWidth, unit }: { point: { x: number; y: number; label: string; value: number }; chartWidth: number; unit: string }) {
  const width = 126;
  const x = Math.max(8, Math.min(chartWidth - width - 8, point.x + 12));
  const y = Math.max(8, point.y - 47);
  return <g className="chart-svg-tooltip" transform={`translate(${x} ${y})`} pointerEvents="none"><rect width={width} height="38" rx="6" /><text x="9" y="15">{shortDate(point.label)}</text><text x="9" y="30">{point.value}{unit ? ` ${unit}` : ''}</text></g>;
}

function nearestPoint(points: ChartPoint[], pointerX: number, chartWidth: number) {
  const minX = points[0]?.x ?? 0;
  const maxX = points.at(-1)?.x ?? minX;
  const relativeX = minX + Math.max(0, Math.min(1, pointerX / chartWidth)) * (maxX - minX);
  return points.reduce((nearest, point) => Math.abs(point.x - relativeX) < Math.abs(nearest.x - relativeX) ? point : nearest, points[0]);
}

function Breakdown({ title, rows }: { title: string; rows: Row[] }) { const max = useMemo(() => Math.max(1, ...rows.map((row) => row.value)), [rows]); return <article className="panel"><div className="panel-heading"><div><h2>{title}</h2><p>Calculated from authorised fleet records.</p></div></div>{rows.length ? <div className="analytics-list">{rows.slice(0, 8).map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong><i style={{ width: `${row.value / max * 100}%` }} /></div>)}</div> : <p className="empty-compact">No data available yet.</p>}</article>; }

function combineActivityRows(requests: { date: string; value: number }[], trips: { date: string; value: number }[]): Row[] {
  const values = new Map<string, number>();
  for (const row of [...requests, ...trips]) values.set(row.date, (values.get(row.date) ?? 0) + row.value);
  return [...values.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([label, value]) => ({ label, value }));
}

function timelinePoints(rows: Row[]) {
  const rawMax = Math.max(1, ...rows.map((row) => row.value));
  const step = Math.max(1, Math.ceil(rawMax / 5));
  const max = step * 5;
  const minX = 58; const maxX = 978; const minY = 24; const maxY = 286;
  const divisor = Math.max(1, rows.length - 1);
  const points = rows.map((row, index) => ({ x: minX + index / divisor * (maxX - minX), y: maxY - row.value / max * (maxY - minY), label: row.label, value: Math.round(row.value * 10) / 10 }));
  const areaPath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
  return { points, max, latest: Math.round((rows.at(-1)?.value ?? 0) * 10) / 10, areaPath, smoothPath: smoothPath(points), ticks: Array.from({ length: 6 }, (_, index) => ({ value: index * step, y: maxY - index / 5 * (maxY - minY) })), verticalGrid: Array.from({ length: 11 }, (_, index) => minX + index / 10 * (maxX - minX)), labelEvery: Math.max(1, Math.ceil(points.length / 12)) };
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 3) return points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midpointX = (previous.x + point.x) / 2;
    const midpointY = (previous.y + point.y) / 2;
    return `${path} Q${previous.x} ${previous.y} ${midpointX} ${midpointY}${index === points.length - 1 ? ` T${point.x} ${point.y}` : ''}`;
  }, '');
}

function chartPoints(rows: Row[], threshold?: number) { const max = Math.max(1, threshold ?? 0, ...rows.map((row) => row.value)); const minX = 24; const maxX = 584; const minY = 28; const maxY = 166; const divisor = Math.max(1, rows.length - 1); const points = rows.map((row, index) => ({ x: minX + index / divisor * (maxX - minX), y: maxY - row.value / max * (maxY - minY), label: row.label, value: Math.round(row.value * 10) / 10 })); return { points, max: Math.round(max * 10) / 10, latest: Math.round((rows.at(-1)?.value ?? 0) * 10) / 10, path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' '), y: (value: number) => maxY - Math.min(value, max) / max * (maxY - minY) }; }
function shortDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date); }
