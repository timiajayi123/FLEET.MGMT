'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

const labels: Record<string, string> = {
  ai: 'AI',
  gps: 'GPS',
};

function labelFor(segment: string) {
  return segment
    .split('-')
    .map((word) => labels[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/analytics/reports') {
    const report = searchParams.get('report');
    const reportLabels: Record<string, string> = {
      requests: 'Vehicle Request Report',
      trips: 'Trip Report',
      'driver-performance': 'Driver Performance Report',
      speed: 'Speed Violation Report',
      utilisation: 'Vehicle Utilisation Report',
      maintenance: 'Maintenance Report',
      fuel: 'Fuel Recorded and Distance Covered',
    };
    return (
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {report && reportLabels[report] ? (
          <>
            <Link href="/analytics/reports">Reports</Link>
            <span>
              <ChevronRight size={13} />
              <span aria-current="page">{reportLabels[report]}</span>
            </span>
          </>
        ) : (
          <span aria-current="page">Reports</span>
        )}
      </nav>
    );
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/dashboard" aria-label="Dashboard">
        <Home size={14} />
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const current = index === segments.length - 1;
        return (
          <span key={href}>
            <ChevronRight size={13} />
            {current ? (
              <span aria-current="page">{labelFor(segment)}</span>
            ) : (
              <Link href={href}>{labelFor(segment)}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
