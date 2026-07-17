'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';

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
  const segments = usePathname().split('/').filter(Boolean);

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
