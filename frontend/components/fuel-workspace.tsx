'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BellRing,
  CheckCircle2,
  Droplets,
  Fuel,
  Gauge,
  GitCompareArrows,
  Plus,
  ReceiptText,
  Send,
  ShieldAlert,
  Ticket,
  X,
} from 'lucide-react';
import { PageHeader } from './page-header';

type Bootstrap = {
  canManage: boolean;
  driver: { id: string; staffName: string } | null;
  activeAllocation: {
    id: string;
    vehicle: {
      id: string;
      registrationNumber: string;
      manufacturer: string;
      model: string;
      vehicleType?: { id: string; name: string } | null;
    };
    driver: { id: string; staffName: string; employeeId: string };
    trip?: { id: string; status: string; calculatedDistance?: number | null } | null;
  } | null;
  cards: {
    id: string;
    maskedNumber: string;
    provider: string;
    status?: string;
    currentBalance?: number | null;
    issueDate?: string;
    expiryDate?: string | null;
  }[];
  vehicles: {
    id: string;
    registrationNumber: string;
    manufacturer: string;
    model: string;
    vehicleType?: { id: string; name: string } | null;
  }[];
  vehicleTypes: { id: string; name: string }[];
  quickStations: { stationName: string; stationLocation: string }[];
};
type FuelEntry = {
  id: string;
  entryNumber: string;
  fuelingAt: string;
  submittedAt?: string | null;
  entryType: string;
  fuelType: string;
  dispensedLitres: number;
  pricePerLitre: number;
  totalAmount: number;
  currentOdometer?: number | null;
  previousOdometer?: number | null;
  distanceTravelled?: number | null;
  tripDistance?: number | null;
  kmPerLitre?: number | null;
  litresPer100Km?: number | null;
  costPerKm?: number | null;
  baselineVariancePct?: number | null;
  distanceSource?: string | null;
  paymentMethod: string;
  comments?: string | null;
  approvalStatus: string;
  vehicle: {
    registrationNumber: string;
    manufacturer: string;
    model: string;
    vehicleType?: { name: string } | null;
  };
  driver?: { staffName: string; employeeId: string } | null;
  station?: { name: string; state?: string | null; city?: string | null } | null;
  stationName?: string | null;
  stationLocation?: string | null;
  alerts: { id: string; severity: string; message: string }[];
  attachments: {
    id: string;
    kind: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }[];
  approvals: {
    id: string;
    stage: string;
    status: string;
    comment?: string | null;
    actor?: { staffName: string } | null;
  }[];
};
type FuelDashboard = {
  period?: { days: number; from: string; to: string };
  metrics: {
    totalSpend: number;
    totalLitres: number;
    averageConsumption: number;
    averageCostPerKm: number;
    vehiclesOverBaseline: number;
    openAlerts: number;
  };
  alerts: { id: string; alertType: string; severity: string; message: string }[];
  approvalQueue: FuelEntry[];
};

export function FuelWorkspace({
  view = 'operations',
}: {
  view?: 'dashboard' | 'operations' | 'history' | 'cards';
}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [dashboard, setDashboard] = useState<FuelDashboard | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<FuelEntry | null>(null);
  const [decisionPrompt, setDecisionPrompt] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [dashboardDays, setDashboardDays] = useState('30');
  const [newEntryCount, setNewEntryCount] = useState(0);
  const knownPendingEntryIds = useRef<Set<string> | null>(null);
  const load = useCallback(async () => {
    setError('');
    try {
      const initial = await fetch('/api/fuel/bootstrap');
      const initialBody = await initial.json();
      if (!initial.ok) throw new Error(initialBody.message || 'Unable to load fuel workspace.');
      setBootstrap(initialBody.data);
      const requests = [fetch('/api/fuel/entries')];
      if (initialBody.data.canManage)
        requests.push(fetch(`/api/fuel/dashboard?days=${dashboardDays}`));
      const [entryResponse, dashboardResponse] = await Promise.all(requests);
      const entryBody = await entryResponse.json();
      if (!entryResponse.ok) throw new Error(entryBody.message || 'Unable to load fuel entries.');
      setEntries(entryBody.data ?? []);
      if (dashboardResponse) {
        const body = await dashboardResponse.json();
        if (dashboardResponse.ok) {
          const pendingIds = new Set<string>(
            (body.data?.approvalQueue ?? []).map((entry: FuelEntry) => entry.id),
          );
          if (knownPendingEntryIds.current) {
            const added = [...pendingIds].filter(
              (entryId) => !knownPendingEntryIds.current?.has(entryId),
            ).length;
            if (added) setNewEntryCount((current) => current + added);
          }
          knownPendingEntryIds.current = pendingIds;
          setDashboard(body.data);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load fuel workspace.');
    }
  }, [dashboardDays]);
  useEffect(() => {
    // The initial API request owns the resulting loading state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (!bootstrap?.canManage || view !== 'dashboard') return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [bootstrap?.canManage, load, view]);
  const allocation = bootstrap?.activeAllocation;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setSaving(true);
    setError('');
    const data = new FormData(form);
    data.set('submit', 'true');
    try {
      const response = await fetch('/api/fuel/entries', { method: 'POST', body: data });
      const body = await response.json();
      if (!response.ok) throw new Error(formatFuelError(body.message));
      setMessage(`Fuel entry ${body.data.entryNumber} submitted for approval.`);
      form.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit fuel entry.');
      window.requestAnimationFrame(() => {
        document
          .querySelector('.fuel-form-error')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } finally {
      setSaving(false);
    }
  }
  async function decide(decision: 'APPROVE' | 'REJECT', comment: string) {
    if (!selected) return;
    if (decision === 'REJECT' && !comment.trim()) {
      setDecisionError('Enter a clear rejection reason before continuing.');
      return;
    }
    setSaving(true);
    setDecisionError('');
    try {
      const response = await fetch(`/api/fuel/entries/${selected.id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment: comment.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save approval decision.');
      setDecisionPrompt(null);
      setSelected(null);
      setMessage(
        decision === 'APPROVE'
          ? 'Fuel entry moved to the next approval stage.'
          : 'Fuel entry rejected and recorded in the audit trail.',
      );
      await load();
    } catch (reason) {
      setDecisionError(
        reason instanceof Error ? reason.message : 'Unable to save approval decision.',
      );
    } finally {
      setSaving(false);
    }
  }
  const metrics = dashboard?.metrics;
  const title =
    view === 'dashboard'
      ? 'Fuel Dashboard'
      : view === 'history'
        ? 'Fuel History'
      : view === 'cards'
        ? 'Fuel Coupons'
      : bootstrap?.canManage
            ? 'Fuel Operations'
            : 'Fuel Entry';
  return (
    <>
      <PageHeader
        title={title}
        description={
          bootstrap?.canManage
            ? 'Enterprise fuel operations, approvals, coupons, pricing, controls and reconciliation.'
            : 'Submit fuel usage against your active allocation. Every record is linked permanently to the vehicle, driver, allocation and trip.'
        }
      />
      {error && <div className="master-alert">{error}</div>}
      {message && (
        <div className="fuel-toast">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}
      {view === 'dashboard' && bootstrap?.canManage && (
        <div className="fuel-dashboard-period">
          <div>
            <strong>Dashboard duration</strong>
            <small>Change the period used for fuel spend, litres and efficiency.</small>
          </div>
          <select value={dashboardDays} onChange={(event) => setDashboardDays(event.target.value)}>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last 1 year</option>
            <option value="730">Last 2 years</option>
          </select>
        </div>
      )}
      {view === 'dashboard' && bootstrap?.canManage && metrics && (
        <section className="fuel-kpi-grid">
          <Kpi
            icon={BadgeDollarSign}
            label={`Fuel spend (${dashboardDays} days)`}
            value={money(metrics.totalSpend)}
          />
          <Kpi
            icon={Droplets}
            label="Total litres"
            value={`${metrics.totalLitres?.toFixed?.(1) ?? 0} L`}
          />
          <Kpi
            icon={AlertTriangle}
            label="Vehicles over baseline"
            value={String(metrics.vehiclesOverBaseline)}
          />
          <Kpi icon={ShieldAlert} label="Open fuel alerts" value={String(metrics.openAlerts)} />
        </section>
      )}
      {view === 'dashboard' && bootstrap?.canManage && (
        <div className="fuel-comparison-launch">
          <button className="primary-action" onClick={() => setComparisonOpen(true)}>
            <GitCompareArrows size={17} /> Fuel Recorded and Distance Covered
          </button>
          <p>
            Compare fuel recorded with distance covered by a driver, or review a vehicle across
            every driver who used it.
          </p>
        </div>
      )}
      {bootstrap &&
        view === 'dashboard' &&
        (bootstrap.canManage ? (
          <section className="fuel-layout">
            <article className="panel fuel-history-panel">
              <div className="panel-heading">
                <div>
                  <h2>APPROVE FUEL REQUEST</h2>
                  <p>Submitted entries awaiting workflow review.</p>
                </div>
                <div className="fuel-queue-indicators" aria-live="polite">
                  <span>{dashboard?.approvalQueue.length ?? 0} awaiting review</span>
                  {newEntryCount > 0 && (
                    <button type="button" onClick={() => setNewEntryCount(0)}>
                      <BellRing size={14} />
                      {newEntryCount} new {newEntryCount === 1 ? 'entry' : 'entries'}
                    </button>
                  )}
                  <ReceiptText size={20} />
                </div>
              </div>
              <FuelEntryList
                entries={dashboard ? dashboard.approvalQueue : entries}
                canManage
                onSelect={setSelected}
              />
            </article>
            <article className="panel fuel-history-panel">
              <div className="panel-heading">
                <div>
                  <h2>Fuel controls</h2>
                  <p>Open alerts and variance checks requiring attention.</p>
                </div>
                <ShieldAlert size={20} />
              </div>
              {dashboard?.alerts?.length ? (
                <div className="fuel-alert-list">
                  {dashboard.alerts.map((alert) => (
                    <span key={alert.id} className={alert.severity.toLowerCase()}>
                      <AlertTriangle size={14} />
                      {alert.message}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="master-empty">
                  <CheckCircle2 size={28} />
                  <h2>No open fuel alerts</h2>
                  <p>Fuel control warnings will appear here.</p>
                </div>
              )}
            </article>
          </section>
        ) : (
          <section className="fuel-layout driver-fuel-layout">
            <article className="panel fuel-entry-panel">
              <div className="panel-heading">
                <div>
                  <h2>Upload fuel record</h2>
                  <p>
                    Submit your fuel details, receipt and dashboard or odometer photo for approval.
                  </p>
                </div>
                <Fuel size={21} />
              </div>
              {bootstrap.driver ? (
                <DriverFuelEntryForm
                  driver={bootstrap.driver}
                  vehicles={bootstrap.vehicles}
                  allocation={allocation}
                  quickStations={bootstrap.quickStations}
                  saving={saving}
                  error={error}
                  onSubmit={submit}
                />
              ) : (
                <div className="master-empty">
                  <Fuel size={30} />
                  <h2>Driver profile required</h2>
                  <p>
                    Your account must be linked to a driver profile before submitting fuel records.
                  </p>
                </div>
              )}
            </article>
          </section>
        ))}
      {bootstrap && view === 'operations' && (
        <section className={`fuel-layout ${bootstrap.canManage ? '' : 'driver-fuel-layout'}`}>
          <article className="panel fuel-entry-panel">
            <div className="panel-heading">
              <div>
                <h2>Fuel entry</h2>
                <p>
                  Complete all required fueling details. Calculations and controls are applied
                  automatically.
                </p>
              </div>
              <Fuel size={21} />
            </div>
            {bootstrap.driver ? (
              <DriverFuelEntryForm
                driver={bootstrap.driver}
                vehicles={bootstrap.vehicles}
                allocation={allocation}
                quickStations={bootstrap.quickStations}
                saving={saving}
                error={error}
                onSubmit={submit}
              />
            ) : (
              <div className="master-empty">
                <Fuel size={30} />
                <h2>Driver profile required</h2>
                <p>
                  Your account must be linked to a driver profile before submitting fuel records.
                </p>
              </div>
            )}
          </article>
          <article className="panel fuel-history-panel">
            <div className="panel-heading">
              <div>
                <h2>{bootstrap.canManage ? 'Fuel approval queue & history' : 'My fuel history'}</h2>
                <p>
                  {bootstrap.canManage
                    ? 'Review submitted entries and investigate warnings before approval.'
                    : 'Your submitted entries and their approval status.'}
                </p>
              </div>
              <ReceiptText size={20} />
            </div>
            <FuelEntryList
              entries={entries}
              canManage={Boolean(bootstrap.canManage)}
              onSelect={setSelected}
            />
          </article>
        </section>
      )}
      {bootstrap && view === 'history' && (
        <section className="panel fuel-history-page">
          <div className="panel-heading fuel-history-heading">
            <div>
              <h2>FUEL HISTORY</h2>
              <p>
                {bootstrap.canManage
                  ? 'Every submitted fuel record, including approved and rejected entries.'
                  : 'Your submitted fuel records and approval status.'}
              </p>
            </div>
            <ReceiptText size={22} />
          </div>
          <FuelEntryList entries={entries} canManage={bootstrap.canManage} onSelect={setSelected} />
        </section>
      )}
      {bootstrap?.canManage && view === 'cards' && (
        <FuelCardsPanel cards={bootstrap.cards} vehicles={bootstrap.vehicles} onCreated={load} />
      )}
      {selected && (
        <div className="master-modal-backdrop">
          <FuelReviewModal
            entry={selected}
            canManage={Boolean(bootstrap?.canManage)}
            onClose={() => setSelected(null)}
            onDecision={(decision) => {
              setDecisionError('');
              setDecisionPrompt(decision);
            }}
          />
        </div>
      )}
      {selected && decisionPrompt && (
        <FuelDecisionPrompt
          entry={selected}
          decision={decisionPrompt}
          error={decisionError}
          saving={saving}
          onClose={() => {
            setDecisionError('');
            setDecisionPrompt(null);
          }}
          onSubmit={(comment) => void decide(decisionPrompt, comment)}
        />
      )}
      {comparisonOpen && <FuelComparisonModal onClose={() => setComparisonOpen(false)} />}
    </>
  );
}

type FuelComparison = {
  metrics: {
    fuelRecords: number;
    litres: number;
    spend: number;
    tripDistance: number;
    odometerDistance: number;
    kmPerLitre: number | null;
  };
  vehicles: { id: string; registrationNumber: string; manufacturer: string; model: string }[];
  drivers: { id: string; staffName: string; employeeId: string; category?: string | null }[];
  fuelEntries: {
    id: string;
    entryNumber: string;
    fuelingAt: string;
    vehicleId: string;
    driverId: string;
    dispensedLitres: number;
    totalAmount: number;
    currentOdometer?: number | null;
    distanceTravelled?: number | null;
    kmPerLitre?: number | null;
    approvalStatus: string;
    vehicle: { registrationNumber: string };
    driver: { staffName: string; employeeId: string; category?: string | null };
  }[];
  trips: {
    id: string;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
    calculatedDistance?: number | null;
    vehicleId: string;
    driverId: string;
    vehicle: { registrationNumber: string };
    driver: { staffName: string; employeeId: string; category?: string | null };
  }[];
  allocations: {
    id: string;
    status: string;
    purpose: string;
    startAt: string;
    expectedEndAt: string;
    vehicleId: string;
    driverId: string;
    vehicle: { registrationNumber: string };
    driver: { staffName: string; employeeId: string; category?: string | null };
    trip?: { calculatedDistance?: number | null; status: string } | null;
  }[];
};

function FuelComparisonModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<FuelComparison | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [duration, setDuration] = useState('90');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadComparison = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ from, to });
    if (vehicleId) params.set('vehicleId', vehicleId);
    if (driverId) params.set('driverId', driverId);
    try {
      const response = await fetch(`/api/fuel/comparison?${params}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load comparison.');
      setData(body.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load comparison.');
    } finally {
      setLoading(false);
    }
  }, [driverId, from, to, vehicleId]);
  useEffect(() => {
    // The comparison request owns its loading and error states.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadComparison();
  }, [loadComparison]);
  const driverRows = data ? comparisonDrivers(data) : [];
  const vehicleRows = data ? comparisonVehicles(data) : [];
  function changeDuration(value: string) {
    setDuration(value);
    if (value === 'custom') return;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Number(value));
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }
  return (
    <div className="master-modal-backdrop">
      <section
        className="fuel-comparison-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fuel-comparison-title"
      >
        <header>
          <div>
            <small>FUEL & DISTANCE ANALYSIS</small>
            <h2 id="fuel-comparison-title">Fuel Recorded and Distance Covered</h2>
            <p>
              Includes all recorded drivers, vehicles, trips and allocation periods—temporary or
              long-term.
            </p>
            <small>Efficiency = distance in km divided by fuel litres. Odometer distance is preferred; GPS trip distance is used when odometer distance is unavailable.</small>
          </div>
          <button aria-label="Close comparison" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="fuel-comparison-filters">
          <label>
            <span>Vehicle</span>
            <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              <option value="">All vehicles</option>
              {data?.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registrationNumber} — {vehicle.manufacturer} {vehicle.model}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Driver</span>
            <select value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">All drivers</option>
              {data?.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.staffName} — {driver.employeeId}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Duration</span>
            <select value={duration} onChange={(event) => changeDuration(event.target.value)}>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last 1 year</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          {duration === 'custom' && <>
            <label>
              <span>From</span>
              <input type="date" value={from} onChange={(event) => { setDuration('custom'); setFrom(event.target.value); }} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={to} onChange={(event) => { setDuration('custom'); setTo(event.target.value); }} />
            </label>
          </>}
        </div>
        {error && (
          <div className="fuel-form-error">
            <AlertTriangle />
            <div>
              <strong>Comparison could not be loaded</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
        {loading ? (
          <div className="master-loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          data && (
            <div className="fuel-comparison-content">
              <section className="fuel-comparison-kpis">
                <Kpi
                  icon={ReceiptText}
                  label="Fuel reports"
                  value={String(data.metrics.fuelRecords)}
                />
                <Kpi
                  icon={Droplets}
                  label="Fuel supplied"
                  value={`${Number(data.metrics.litres).toFixed(1)} L`}
                />
                <Kpi
                  icon={Gauge}
                  label="Trip distance"
                  value={`${Number(data.metrics.tripDistance).toFixed(2)} km`}
                />
                <Kpi
                  icon={GitCompareArrows}
                  label="Odometer distance"
                  value={`${Number(data.metrics.odometerDistance).toFixed(2)} km`}
                />
                <Kpi
                  icon={Fuel}
                  label="Actual km/L"
                  value={
                    data.metrics.kmPerLitre == null
                      ? 'No comparison'
                      : Number(data.metrics.kmPerLitre).toFixed(2)
                  }
                />
                <Kpi icon={BadgeDollarSign} label="Fuel spend" value={money(data.metrics.spend)} />
              </section>
              <ComparisonTable
                title="Driver comparison"
                description="Fuel claimed and distance recorded for each driver, regardless of which vehicle they used."
                rows={driverRows}
                firstLabel="Driver"
              />
              <ComparisonTable
                title="Vehicle comparison"
                description="Fuel and distance for each vehicle, including every driver who used it."
                rows={vehicleRows}
                firstLabel="Vehicle"
              />
              <section className="fuel-comparison-section">
                <h3>Allocation and usage history</h3>
                <p>
                  Shows vehicle-driver pairings during the selected period, including completed and
                  current allocations.
                </p>
                <div className="fuel-comparison-list">
                  {data.allocations.map((item) => (
                    <article key={item.id}>
                      <strong>
                        {item.vehicle.registrationNumber} · {item.driver.staffName}
                      </strong>
                      <span>
                        {item.driver.category || 'Driver category not recorded'} ·{' '}
                        {label(item.status)}
                      </span>
                      <small>
                        {new Date(item.startAt).toLocaleDateString()} –{' '}
                        {new Date(item.expectedEndAt).toLocaleDateString()} · {item.purpose}
                      </small>
                      <em>
                        {item.trip?.calculatedDistance
                          ? `${Number(item.trip.calculatedDistance).toFixed(2)} km recorded`
                          : 'No completed distance recorded'}
                      </em>
                    </article>
                  ))}
                </div>
              </section>
              <section className="fuel-comparison-section">
                <h3>Fuel reports under the selected scope</h3>
                <div className="fuel-comparison-list">
                  {data.fuelEntries.map((item) => (
                    <article key={item.id}>
                      <strong>
                        {item.entryNumber} · {item.vehicle.registrationNumber}
                      </strong>
                      <span>
                        {item.driver.staffName} · {Number(item.dispensedLitres).toFixed(1)} L ·{' '}
                        {money(item.totalAmount)}
                      </span>
                      <small>
                        {new Date(item.fuelingAt).toLocaleString()} · Odometer{' '}
                        {item.currentOdometer == null
                          ? 'not recorded'
                          : `${Number(item.currentOdometer).toLocaleString()} km`}
                      </small>
                      <em>
                        {item.distanceTravelled == null
                          ? 'Awaiting distance comparison'
                          : `${Number(item.distanceTravelled).toFixed(2)} km since prior fueling`}
                      </em>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )
        )}
      </section>
    </div>
  );
}

type ComparisonRow = {
  name: string;
  subtitle: string;
  litres: number;
  distance: number;
  spend: number;
  efficiency: number | null;
  records: number;
};
function comparisonDrivers(data: FuelComparison): ComparisonRow[] {
  return data.drivers
    .map((driver) => {
      const fuel = data.fuelEntries.filter((row) => row.driverId === driver.id);
      const trips = data.trips.filter((row) => row.driverId === driver.id);
      const litres = fuel.reduce((sum, row) => sum + Number(row.dispensedLitres), 0);
      const distance = trips.reduce((sum, row) => sum + Number(row.calculatedDistance ?? 0), 0);
      return {
        name: driver.staffName,
        subtitle: `${driver.employeeId} · ${driver.category || 'Category not recorded'}`,
        litres,
        distance,
        spend: fuel.reduce((sum, row) => sum + Number(row.totalAmount), 0),
        efficiency: litres ? distance / litres : null,
        records: fuel.length,
      };
    })
    .filter((row) => row.records || row.distance);
}
function comparisonVehicles(data: FuelComparison): ComparisonRow[] {
  return data.vehicles
    .map((vehicle) => {
      const fuel = data.fuelEntries.filter((row) => row.vehicleId === vehicle.id);
      const trips = data.trips.filter((row) => row.vehicleId === vehicle.id);
      const litres = fuel.reduce((sum, row) => sum + Number(row.dispensedLitres), 0);
      const distance = trips.reduce((sum, row) => sum + Number(row.calculatedDistance ?? 0), 0);
      const drivers = new Set([
        ...fuel.map((row) => row.driver.staffName),
        ...trips.map((row) => row.driver.staffName),
      ]);
      return {
        name: vehicle.registrationNumber,
        subtitle: `${vehicle.manufacturer} ${vehicle.model} · ${[...drivers].join(', ') || 'No driver recorded'}`,
        litres,
        distance,
        spend: fuel.reduce((sum, row) => sum + Number(row.totalAmount), 0),
        efficiency: litres ? distance / litres : null,
        records: fuel.length,
      };
    })
    .filter((row) => row.records || row.distance);
}
function ComparisonTable({
  title,
  description,
  rows,
  firstLabel,
}: {
  title: string;
  description: string;
  rows: ComparisonRow[];
  firstLabel: string;
}) {
  return (
    <section className="fuel-comparison-section">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="fuel-comparison-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{firstLabel}</th>
              <th>Fuel reports</th>
              <th>Litres</th>
              <th>Distance</th>
              <th>Efficiency</th>
              <th>Spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>
                  <strong>{row.name}</strong>
                  <small>{row.subtitle}</small>
                </td>
                <td>{row.records}</td>
                <td>{row.litres.toFixed(1)} L</td>
                <td>{row.distance.toFixed(2)} km</td>
                <td>{row.efficiency == null ? '—' : `${row.efficiency.toFixed(2)} km/L`}</td>
                <td>{money(row.spend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="fuel-review-empty">No matching fuel or distance records were found.</p>
      )}
    </section>
  );
}

function FuelDecisionPrompt({
  entry,
  decision,
  error,
  saving,
  onClose,
  onSubmit,
}: {
  entry: FuelEntry;
  decision: 'APPROVE' | 'REJECT';
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const rejecting = decision === 'REJECT';
  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const comment = String(new FormData(event.currentTarget).get('comment') ?? '');
    onSubmit(comment);
  }
  return (
    <div className="master-modal-backdrop fuel-decision-backdrop">
      <section
        className={`fuel-decision-prompt ${rejecting ? 'reject' : 'approve'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fuel-decision-title"
      >
        <header>
          <span className="fuel-decision-icon">
            {rejecting ? <X size={24} /> : <CheckCircle2 size={24} />}
          </span>
          <div>
            <small>{rejecting ? 'REJECT FUEL RECORD' : 'APPROVE FUEL RECORD'}</small>
            <h2 id="fuel-decision-title">
              {rejecting ? 'Give a rejection reason' : 'Confirm this approval'}
            </h2>
            <p>
              {entry.entryNumber} · {entry.vehicle.registrationNumber} ·{' '}
              {entry.driver?.staffName ?? 'Driver unavailable'}
            </p>
          </div>
          <button type="button" aria-label="Close decision window" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submitDecision}>
          <label>
            <span>{rejecting ? 'Rejection reason' : 'Approval comment (optional)'}</span>
            <textarea
              name="comment"
              rows={5}
              required={rejecting}
              minLength={rejecting ? 5 : undefined}
              maxLength={2000}
              autoFocus
              placeholder={
                rejecting
                  ? 'Clearly explain why this fuel record is being rejected.'
                  : 'Add any useful approval note for the audit trail.'
              }
            />
            <small>
              {rejecting
                ? 'This reason will be saved in the approval history for the driver and reviewers.'
                : 'The approval and your identity will be recorded in the audit history.'}
            </small>
          </label>
          {error && (
            <div className="fuel-decision-error" role="alert">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          <footer>
            <button type="button" className="secondary-action" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className={rejecting ? 'danger-confirm-action' : 'primary-action'}
              disabled={saving}
            >
              {saving ? 'Saving decision…' : rejecting ? 'Confirm rejection' : 'Confirm approval'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function FuelReviewModal({
  entry,
  canManage,
  onClose,
  onDecision,
}: {
  entry: FuelEntry;
  canManage: boolean;
  onClose: () => void;
  onDecision: (decision: 'APPROVE' | 'REJECT') => void;
}) {
  const awaitingDecision =
    canManage &&
    ['FLEET_SUPERVISOR_PENDING', 'FLEET_MANAGER_PENDING'].includes(entry.approvalStatus);
  return (
    <section
      className="fuel-decision-modal fuel-review-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fuel-review-title"
    >
      <header>
        <div>
          <small>FUEL RECORD REVIEW</small>
          <h2 id="fuel-review-title">{entry.entryNumber}</h2>
          <p>
            {awaitingDecision
              ? 'Review every section before making an approval decision.'
              : 'View the complete submitted record and its approval history.'}
          </p>
        </div>
        <button aria-label="Close fuel review" onClick={onClose}>
          <X size={19} />
        </button>
      </header>
      <ReviewSection title="Submission details">
        <ReviewValue label="Record status" value={fuelEntryStatusLabel(entry.approvalStatus)} />
        <ReviewValue label="Date of fueling" value={new Date(entry.fuelingAt).toLocaleString()} />
        <ReviewValue
          label="Submitted on"
          value={entry.submittedAt ? new Date(entry.submittedAt).toLocaleString() : 'Not recorded'}
        />
        <ReviewValue label="Entry type" value={label(entry.entryType)} />
      </ReviewSection>
      <ReviewSection title="Driver and vehicle">
        <ReviewValue
          label="Driver name"
          value={entry.driver?.staffName ?? 'Driver record unavailable'}
        />
        <ReviewValue
          label="Driver employee ID"
          value={entry.driver?.employeeId ?? 'Not recorded'}
        />
        <ReviewValue label="Plate number" value={entry.vehicle.registrationNumber} />
        <ReviewValue label="Vehicle type" value={fullVehicleType(entry.vehicle)} />
      </ReviewSection>
      <ReviewSection title="Fuel station">
        <ReviewValue
          label="Station name"
          value={entry.stationName ?? entry.station?.name ?? 'Not recorded'}
        />
        <ReviewValue
          label="Station location"
          value={
            entry.stationLocation ??
            ([entry.station?.city, entry.station?.state].filter(Boolean).join(', ') ||
              'Not recorded')
          }
        />
      </ReviewSection>
      <ReviewSection title="Fuel quantity and cost">
        <ReviewValue label="Fuel type" value={entry.fuelType} />
        <ReviewValue
          label="Quantity supplied"
          value={`${Number(entry.dispensedLitres).toFixed(3)} litres`}
        />
        <ReviewValue label="Price per litre" value={money(entry.pricePerLitre)} />
        <ReviewValue label="Total amount" value={money(entry.totalAmount)} highlight />
        <ReviewValue label="Payment method" value={entry.paymentMethod} />
      </ReviewSection>
      <ReviewSection title="Odometer and distance comparison">
        <ReviewValue label="Previous approved odometer" value={distance(entry.previousOdometer)} />
        <ReviewValue label="Current odometer" value={distance(entry.currentOdometer)} />
        <ReviewValue
          label="Distance since last fueling"
          value={distance(entry.distanceTravelled)}
        />
        <ReviewValue label="Recorded trip distance" value={distance(entry.tripDistance)} />
        <ReviewValue
          label="Distance source"
          value={entry.distanceSource ? label(entry.distanceSource) : 'Not available'}
        />
        <ReviewValue
          label="Fuel efficiency"
          value={
            entry.kmPerLitre == null
              ? 'Pending comparison'
              : `${Number(entry.kmPerLitre).toFixed(2)} km/L`
          }
        />
        <ReviewValue
          label="Fuel used per 100 km"
          value={
            entry.litresPer100Km == null
              ? 'Pending comparison'
              : `${Number(entry.litresPer100Km).toFixed(2)} L/100 km`
          }
        />
        <ReviewValue
          label="Cost per kilometre"
          value={entry.costPerKm == null ? 'Pending comparison' : money(entry.costPerKm)}
        />
        <ReviewValue
          label="Baseline variance"
          value={
            entry.baselineVariancePct == null
              ? 'No baseline configured'
              : `${Number(entry.baselineVariancePct).toFixed(1)}%`
          }
        />
      </ReviewSection>
      <section className="fuel-review-section">
        <h3>Uploaded evidence</h3>
        {entry.attachments.length ? (
          <div className="fuel-evidence-list">
            {entry.attachments.map((file) => (
              <span key={file.id}>
                <ReceiptText size={16} />
                <b>{attachmentLabel(file.kind)}</b>
                <em>
                  {file.fileName} · {fileSize(file.sizeBytes)}
                </em>
              </span>
            ))}
          </div>
        ) : (
          <p className="fuel-review-empty">No coupon or supporting file was uploaded.</p>
        )}
      </section>
      <section className="fuel-review-section">
        <h3>Automated checks and warnings</h3>
        <div className="fuel-alert-list">
          {entry.alerts.length ? (
            entry.alerts.map((alert) => (
              <span key={alert.id} className={alert.severity.toLowerCase()}>
                <AlertTriangle size={14} />
                <b>{label(alert.severity)}:</b> {alert.message}
              </span>
            ))
          ) : (
            <span className="ok">
              <CheckCircle2 size={14} />
              All automated checks passed with no warnings.
            </span>
          )}
        </div>
      </section>
      <section className="fuel-review-section">
        <h3>Approval history</h3>
        {entry.approvals.length ? (
          <div className="fuel-approval-history">
            {entry.approvals.map((approval) => (
              <span key={approval.id}>
                <b>{label(approval.stage)}</b>
                <em>
                  {label(approval.status)}
                  {approval.actor ? ` · ${approval.actor.staffName}` : ''}
                </em>
                {approval.comment && <small>{approval.comment}</small>}
              </span>
            ))}
          </div>
        ) : (
          <p className="fuel-review-empty">No approval action has been recorded yet.</p>
        )}
      </section>
      {entry.comments && (
        <section className="fuel-review-section">
          <h3>Driver comments</h3>
          <p className="fuel-review-comments">{entry.comments}</p>
        </section>
      )}
      <footer>
        {awaitingDecision ? (
          <>
            <button className="secondary-action" onClick={() => void onDecision('REJECT')}>
              Reject record
            </button>
            <button className="primary-action" onClick={() => void onDecision('APPROVE')}>
              Approve current stage
            </button>
          </>
        ) : (
          <button className="primary-action" onClick={onClose}>Close record</button>
        )}
      </footer>
    </section>
  );
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fuel-review-section">
      <h3>{title}</h3>
      <dl className="fuel-review-grid">{children}</dl>
    </section>
  );
}
function ReviewValue({
  label: title,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'highlight' : ''}>
      <dt>{title}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DriverFuelEntryForm({
  driver,
  vehicles,
  allocation,
  quickStations,
  saving,
  error,
  onSubmit,
}: {
  driver: NonNullable<Bootstrap['driver']>;
  vehicles: Bootstrap['vehicles'];
  allocation?: Bootstrap['activeAllocation'];
  quickStations: Bootstrap['quickStations'];
  saving: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [litres, setLitres] = useState('');
  const [price, setPrice] = useState('');
  const [stationName, setStationName] = useState('');
  const [stationLocation, setStationLocation] = useState('');
  const [vehicleId, setVehicleId] = useState(allocation?.vehicle.id ?? '');
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const total = Number(litres || 0) * Number(price || 0);

  function useQuickStation(value: string) {
    if (!value) return;
    const station = quickStations[Number(value)];
    if (!station) return;
    setStationName(station.stationName);
    setStationLocation(station.stationLocation);
  }

  return (
    <form className="fuel-entry-form driver-fuel-entry-form" onSubmit={onSubmit}>
      <details open>
        <summary>Driver and vehicle details</summary>
        <div className="fuel-snapshot">
          <span>
            <small>Driver name</small>
            <strong>{driver.staffName}</strong>
          </span>
          <span>
            <small>Select vehicle</small>
            <select
              name="vehicleId"
              required
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
            >
              <option value="">Select plate number and vehicle type</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registrationNumber} — {fullVehicleType(vehicle)}
                </option>
              ))}
            </select>
            <em>
              {selectedVehicle
                ? fullVehicleType(selectedVehicle)
                : 'Select the vehicle that was fueled'}
            </em>
          </span>
        </div>
      </details>
      <details open>
        <summary>Fueling form</summary>
        <div className="fuel-fields">
          <Field
            label="Date of fueling"
            name="fuelingAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
          />
          <Select
            label="Fuel type"
            name="fuelType"
            values={['PMS', 'AGO / Diesel', 'LPG', 'CNG']}
          />
          {quickStations.length > 0 && (
            <label className="fuel-field full">
              <span>Quick entry (optional)</span>
              <select defaultValue="" onChange={(event) => useQuickStation(event.target.value)}>
                <option value="">Select a previously entered fuel station</option>
                {quickStations.map((station, index) => (
                  <option
                    key={`${station.stationName}-${station.stationLocation}`}
                    value={index}
                  >
                    {station.stationName} — {station.stationLocation}
                  </option>
                ))}
              </select>
              <small>Selecting a quick entry fills the station name and location below.</small>
            </label>
          )}
          <label className="fuel-field">
            <span>Fuel Station Name</span>
            <input
              name="stationName"
              required
              maxLength={200}
              value={stationName}
              onChange={(event) => setStationName(event.target.value)}
              placeholder="Enter fuel station name"
            />
          </label>
          <label className="fuel-field">
            <span>Fuel station location</span>
            <input
              name="stationLocation"
              required
              maxLength={500}
              value={stationLocation}
              onChange={(event) => setStationLocation(event.target.value)}
              placeholder="City, state or full address"
            />
          </label>
          <Field
            label="Vehicle current odometer reading (km)"
            name="currentOdometer"
            type="number"
            min="0"
            step="0.01"
          />
          <label className="fuel-field">
            <span>Quantity of fuel taken (L)</span>
            <input
              name="dispensedLitres"
              type="number"
              min="0.001"
              step="0.001"
              required
              value={litres}
              onChange={(event) => setLitres(event.target.value)}
            />
          </label>
          <label className="fuel-field">
            <span>Fuel price per litre (₦)</span>
            <input
              name="pricePerLitre"
              type="number"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <div className="fuel-calculated-total">
            <span>Total amount (price × quantity)</span>
            <strong>{money(total)}</strong>
            <small>Calculated automatically and not submitted as a separate field.</small>
          </div>
          <Upload label="Upload fuel coupon (optional)" name="coupon" />
          <input type="hidden" name="entryType" value="REFUEL" />
          <input type="hidden" name="paymentMethod" value="Coupon / Driver submission" />
        </div>
      </details>
      {error && (
        <div className="fuel-form-error" role="alert" aria-live="assertive">
          <AlertTriangle size={22} />
          <div>
            <strong>Fuel record could not be submitted</strong>
            <p>{error}</p>
            <small>Check the highlighted required information and try again.</small>
          </div>
        </div>
      )}
      <footer>
        <small>
          The system stores the driver, vehicle, last approved odometer, distance travelled, trip
          distance and calculated fuel efficiency for comparison and audit.
        </small>
        <button className="primary-action" disabled={saving}>
          {saving ? (
            'Submitting…'
          ) : (
            <>
              <Send size={16} /> Submit fuel record
            </>
          )}
        </button>
      </footer>
    </form>
  );
}

export function FuelEntryForm({
  allocation,
  cards,
  saving,
  onSubmit,
}: {
  allocation: NonNullable<Bootstrap['activeAllocation']>;
  cards: Bootstrap['cards'];
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="fuel-entry-form" onSubmit={onSubmit}>
      <details open>
        <summary>Fueling details</summary>
        <div className="fuel-fields">
          <Field
            label="Fueling date & time"
            name="fuelingAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
          />
          <Select
            label="Fuel type"
            name="fuelType"
            values={['PMS', 'AGO / Diesel', 'LPG', 'CNG']}
          />
          <Select
            label="Entry type"
            name="entryType"
            values={['REFUEL', 'TOP_UP', 'EMERGENCY']}
            defaultValue="REFUEL"
          />
          <Field
            label="Reason"
            name="reason"
            required={false}
            placeholder="Operational reason for fueling"
          />
        </div>
      </details>
      <details open>
        <summary>Vehicle & assignment snapshot</summary>
        <div className="fuel-snapshot">
          <span>
            <small>Vehicle</small>
            <strong>{allocation.vehicle.registrationNumber}</strong>
            <em>
              {allocation.vehicle.manufacturer} {allocation.vehicle.model}
            </em>
          </span>
          <span>
            <small>Driver</small>
            <strong>{allocation.driver.staffName}</strong>
            <em>{allocation.driver.employeeId}</em>
          </span>
          <span>
            <small>Trip</small>
            <strong>{allocation.trip?.status ?? 'Not started'}</strong>
            <em>
              {allocation.trip?.calculatedDistance
                ? `${allocation.trip.calculatedDistance} km recorded`
                : 'No distance yet'}
            </em>
          </span>
        </div>
      </details>
      <details open>
        <summary>Fuel, payment & evidence</summary>
        <div className="fuel-fields">
          <Field label="State" name="state" required={false} placeholder="State" />
          <Field label="City" name="city" required={false} placeholder="City" />
          <Field label="Pump number" name="pumpNumber" required={false} placeholder="Pump" />
          <Field
            label="Dispensed litres"
            name="dispensedLitres"
            type="number"
            min="0.001"
            step="0.001"
          />
          <Field
            label="Price per litre (₦)"
            name="pricePerLitre"
            type="number"
            min="0"
            step="0.01"
          />
          <Select
            label="Payment method"
            name="paymentMethod"
            values={['Fuel Coupon', 'Cash', 'Transfer', 'Invoice']}
          />
          <Select
            label="Fuel coupon"
            name="fuelCardId"
            values={cards.map((card) => `${card.id}|${card.provider} · ${card.maskedNumber}`)}
            optionValue={(value) => value.split('|')[0]}
            optionLabel={(value) => value.split('|')[1]}
            required={false}
          />
          <Field
            label="Coupon redemption reference"
            name="cardTransactionNumber"
            required={false}
          />
          <Field label="Receipt number" name="receiptNumber" required={false} />
          <Field
            label="Previous odometer"
            name="previousOdometer"
            readOnly
            value="Calculated from last approved entry"
            required={false}
          />
          <Field
            label="Current odometer"
            name="currentOdometer"
            type="number"
            min="0"
            step="0.01"
            required={false}
          />
          <Field
            label="GPS distance (km)"
            name="gpsDistance"
            type="number"
            min="0"
            step="0.01"
            required={false}
          />
          <Field
            label="Engine hours"
            name="engineHours"
            type="number"
            min="0"
            step="0.01"
            required={false}
          />
          <label className="fuel-field full">
            <span>Comments</span>
            <textarea
              name="comments"
              rows={3}
              maxLength={2000}
              placeholder="Optional fueling observations or supplier notes"
            />
          </label>
          <Upload label="Receipt upload" name="receipt" />
          <Upload label="Dashboard photo" name="dashboardPhoto" />
          <Upload label="Odometer photo" name="odometerPhoto" />
        </div>
      </details>
      <footer>
        <small>
          Automatic checks: coupon value, allocation match, duplicate receipt, fuel price tolerance,
          tank capacity, odometer and baseline variance.
        </small>
        <button className="primary-action" disabled={saving}>
          {saving ? (
            'Submitting…'
          ) : (
            <>
              <Send size={16} /> Submit for approval
            </>
          )}
        </button>
      </footer>
    </form>
  );
}
function FuelEntryList({
  entries,
  canManage,
  onSelect,
}: {
  entries: FuelEntry[];
  canManage: boolean;
  onSelect: (entry: FuelEntry) => void;
}) {
  return entries.length ? (
    <div className="fuel-entry-list">
      {entries.map((entry) => {
        const rejection = [...entry.approvals]
          .reverse()
          .find((approval) => approval.status === 'REJECTED');
        return (
        <article key={entry.id} className={entry.approvalStatus === 'REJECTED' ? 'rejected-entry' : ''}>
          <header>
            <div>
              <strong>{entry.entryNumber}</strong>
              <small>
                {new Date(entry.fuelingAt).toLocaleString()} ·{' '}
                {entry.stationName ?? entry.station?.name ?? 'Station not recorded'}
              </small>
            </div>
            <span className={entry.approvalStatus.toLowerCase()}>
              {fuelEntryStatusLabel(entry.approvalStatus)}
            </span>
          </header>
          <dl>
            <div>
              <dt>Vehicle</dt>
              <dd>{entry.vehicle.registrationNumber}</dd>
            </div>
            <div>
              <dt>Driver</dt>
              <dd>{entry.driver?.staffName ?? 'Driver record unavailable'}</dd>
            </div>
            <div>
              <dt>Fuel</dt>
              <dd>
                {entry.dispensedLitres} L {entry.fuelType}
              </dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>{money(entry.totalAmount)}</dd>
            </div>
            <div>
              <dt>Odometer</dt>
              <dd>
                {entry.currentOdometer == null
                  ? 'Not recorded'
                  : `${Number(entry.currentOdometer).toLocaleString()} km`}
              </dd>
            </div>
            <div>
              <dt>Distance since last fuel</dt>
              <dd>
                {entry.distanceTravelled == null
                  ? 'Pending comparison'
                  : `${Number(entry.distanceTravelled).toFixed(2)} km`}
              </dd>
            </div>
            <div>
              <dt>Recorded trip distance</dt>
              <dd>
                {entry.tripDistance == null
                  ? 'No completed trip yet'
                  : `${Number(entry.tripDistance).toFixed(2)} km`}
              </dd>
            </div>
            <div>
              <dt>Fuel efficiency</dt>
              <dd>
                {entry.kmPerLitre == null
                  ? 'Pending comparison'
                  : `${Number(entry.kmPerLitre).toFixed(2)} km/L`}
              </dd>
            </div>
          </dl>
          {entry.alerts.length > 0 && (
            <p className="fuel-warning">
              <AlertTriangle size={14} />
              {entry.alerts.length} control warning{entry.alerts.length > 1 ? 's' : ''}
            </p>
          )}
          {entry.approvalStatus === 'REJECTED' && (
            <p className="fuel-rejection-note">
              <X size={14} />
              <span>
                <strong>Rejection reason</strong>
                {rejection?.comment || 'No rejection reason was recorded.'}
              </span>
            </p>
          )}
          <button className="secondary-action" onClick={() => onSelect(entry)}>
            {canManage &&
            ['FLEET_SUPERVISOR_PENDING', 'FLEET_MANAGER_PENDING'].includes(entry.approvalStatus)
              ? 'Review & approve'
              : 'View full record'}
          </button>
        </article>
        );
      })}
    </div>
  ) : (
    <div className="master-empty">
      <Fuel size={28} />
      <h2>No fuel entries yet</h2>
      <p>Submitted fuel records, alerts and approval history will appear here.</p>
    </div>
  );
}
function FuelCardsPanel({
  cards,
  vehicles,
  onCreated,
}: {
  cards: Bootstrap['cards'];
  vehicles: Bootstrap['vehicles'];
  onCreated: () => void;
}) {
  return (
    <section className="fuel-management-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <h2>Fuel coupons</h2>
            <p>Create and track fuel coupons for approved vehicle fueling.</p>
          </div>
          <Ticket size={20} />
        </div>
        <SimpleForm
          endpoint="/api/fuel/cards"
          fields={[
            ['cardNumber', 'Coupon number'],
            ['provider', 'Coupon issuer'],
            ['issueDate', 'Valid from', 'date'],
            ['expiryDate', 'Expiry date', 'date'],
            ['currentBalance', 'Coupon value (₦)', 'number'],
            ['transactionLimit', 'Maximum redemption (₦)', 'number'],
            ['allowedFuelTypes', 'Allowed fuel types'],
          ]}
          onCreated={onCreated}
        />
        <div className="fuel-coupon-list">
          {cards.map((card) => (
            <article key={card.id}>
              <Ticket size={19} />
              <span>
                <small>Coupon number</small>
                <strong>{card.maskedNumber}</strong>
                <em>{card.provider}</em>
              </span>
              <span>
                <small>Available value</small>
                <strong>{money(Number(card.currentBalance ?? 0))}</strong>
                <em>
                  {card.expiryDate
                    ? `Expires ${new Date(card.expiryDate).toLocaleDateString()}`
                    : 'No expiry date'}
                </em>
              </span>
              <b>{card.status ?? 'ACTIVE'}</b>
            </article>
          ))}
          {!cards.length && <p className="fuel-review-empty">No fuel coupons created yet.</p>}
        </div>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <h2>Vehicle baselines</h2>
            <p>Set expected efficiency and tank capacity.</p>
          </div>
          <Gauge size={20} />
        </div>
        <BaselineForm vehicles={vehicles} onCreated={onCreated} />
      </article>
    </section>
  );
}
function SimpleForm({
  endpoint,
  fields,
  onCreated,
}: {
  endpoint: string;
  fields: [string, string, string?][];
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to save.');
      form.reset();
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="fuel-simple-form" onSubmit={submit}>
      {fields.map(([name, label, type]) => (
        <Field key={name} name={name} label={label} type={type} />
      ))}
      {error && <p className="alert error">{String(error)}</p>}
      <button className="primary-action" disabled={busy}>
        <Plus size={16} />
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
function BaselineForm({
  vehicles,
  onCreated,
}: {
  vehicles: Bootstrap['vehicles'];
  onCreated: () => void;
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleId) return;
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(new FormData(form));
      const response = await fetch(`/api/fuel/baselines/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to save the baseline.');
      form.reset();
      setVehicleId('');
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the baseline.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="fuel-simple-form" onSubmit={submit}>
      <label className="fuel-field">
        <span>Vehicle</span>
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required>
          <option value="">Select vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registrationNumber} · {vehicle.manufacturer} {vehicle.model}
            </option>
          ))}
        </select>
      </label>
      <Field name="expectedKmPerLitre" label="Expected km/L" type="number" />
      <Field name="tankCapacityLitres" label="Tank capacity (L)" type="number" />
      <Field name="acceptableTolerancePct" label="Tolerance %" type="number" />
      {error && <p className="alert error">{error}</p>}
      <button className="primary-action" disabled={busy}>
        {busy ? 'Saving…' : 'Save baseline'}
      </button>
    </form>
  );
}
function Field({
  label,
  name,
  type = 'text',
  required = true,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  [key: string]: unknown;
}) {
  return (
    <label className="fuel-field">
      <span>{label}</span>
      <input name={name} type={type} required={required} {...rest} />
    </label>
  );
}
function Upload({ label, name }: { label: string; name: string }) {
  return (
    <label className="fuel-field">
      <span>{label}</span>
      <input name={name} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
      <small>JPEG, PNG, WebP or PDF; max 8 MB.</small>
    </label>
  );
}
function Select({
  label,
  name,
  values,
  defaultValue,
  required = true,
  optionValue,
  optionLabel,
}: {
  label: string;
  name: string;
  values: string[];
  defaultValue?: string;
  required?: boolean;
  optionValue?: (value: string) => string;
  optionLabel?: (value: string) => string;
}) {
  return (
    <label className="fuel-field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue ?? ''} required={required}>
        <option value="">Select {label.toLowerCase()}</option>
        {values.map((value) => (
          <option key={value} value={optionValue?.(value) ?? value}>
            {optionLabel?.(value) ?? value}
          </option>
        ))}
      </select>
    </label>
  );
}
function Kpi({ icon: Icon, label, value }: { icon: typeof Fuel; label: string; value: string }) {
  return (
    <article className="fuel-kpi">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}
function distance(value?: number | null) {
  return value == null
    ? 'Not recorded'
    : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
}
function attachmentLabel(kind: string) {
  const names: Record<string, string> = {
    coupon: 'Fuel coupon',
    receipt: 'Receipt',
    dashboardPhoto: 'Dashboard photo',
    odometerPhoto: 'Odometer photo',
  };
  return names[kind] ?? label(kind);
}
function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function fullVehicleType(vehicle: {
  manufacturer: string;
  model: string;
  vehicleType?: { name: string } | null;
}) {
  const manufacturer = vehicle.manufacturer.trim();
  const name = (vehicle.vehicleType?.name || vehicle.model).trim();
  return name.toLowerCase().startsWith(manufacturer.toLowerCase())
    ? name
    : `${manufacturer} ${name}`;
}
function formatFuelError(message: unknown) {
  const messages = Array.isArray(message) ? message.map(String) : [String(message || '')];
  const labels: Record<string, string> = {
    vehicleId: 'Vehicle',
    fuelingAt: 'Date of fueling',
    stationName: 'Fuel station name',
    stationLocation: 'Fuel station location',
    currentOdometer: 'Current odometer reading',
    dispensedLitres: 'Fuel quantity',
    pricePerLitre: 'Price per litre',
    fuelType: 'Fuel type',
    paymentMethod: 'Payment method',
  };
  return messages
    .filter(Boolean)
    .map((item) => {
      const unexpected = item.match(/^property (\w+) should not exist$/i);
      if (unexpected)
        return `The form sent an outdated field (${unexpected[1]}). Refresh the page and submit again.`;
      return Object.entries(labels).reduce(
        (text, [field, label]) => text.replaceAll(field, label),
        item,
      );
    })
    .join(' ');
}
function label(value: string) {
  return value.replaceAll('_', ' ');
}

function fuelEntryStatusLabel(value: string) {
  if (value === 'APPROVED' || value === 'POSTED' || value === 'FINANCE_PENDING') {
    return 'Recorded';
  }
  return label(value);
}
