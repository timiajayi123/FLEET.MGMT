'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from './page-header';

type RequestRow = { id: string; requestNumber: string; staffName: string; department: string; unit: string; purposeOfTrip: string; destination: string; status: string; departureDate: string; allocations: { vehicle: { registrationNumber: string }; driver: { staffName: string } }[] };

export function VehicleRequestReport() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search) query.set('search', search);
    fetch(`/api/analytics/reports/vehicle-requests?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load report.');
        return body;
      })
      .then((body) => setRows(body.data ?? []))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [status, search]);

  function exportCsv() {
    const csv = [['Request number', 'Staff', 'Department', 'Unit', 'Purpose', 'Destination', 'Status', 'Departure', 'Vehicle', 'Driver'], ...rows.map((row) => [row.requestNumber, row.staffName, row.department, row.unit, row.purposeOfTrip, row.destination, row.status, new Date(row.departureDate).toLocaleString(), row.allocations[0]?.vehicle.registrationNumber ?? '', row.allocations[0]?.driver.staffName ?? ''])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'vehicle-request-report.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  return <><PageHeader title="Reports" description="Vehicle request reporting from live SQL Server records." actions={<button className="secondary-action" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>} /><section className="panel"><div className="report-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request, staff or destination" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="PENDING_APPROVAL">Pending approval</option><option value="APPROVED">Approved</option><option value="ALLOCATED">Allocated</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select></div>{error && <div className="master-alert">{error}</div>}{loading ? <p>Loading report…</p> : <div className="report-table-wrap"><table><thead><tr><th>Request</th><th>Staff</th><th>Department / Unit</th><th>Purpose</th><th>Destination</th><th>Status</th><th>Assignment</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.requestNumber}</td><td>{row.staffName}</td><td>{row.department}<br /><small>{row.unit}</small></td><td>{row.purposeOfTrip}</td><td>{row.destination}</td><td>{row.status.replaceAll('_', ' ')}</td><td>{row.allocations[0] ? `${row.allocations[0].vehicle.registrationNumber} · ${row.allocations[0].driver.staffName}` : '—'}</td></tr>)}{!rows.length && <tr><td colSpan={7}>No matching vehicle requests.</td></tr>}</tbody></table></div>}</section></>;
}
