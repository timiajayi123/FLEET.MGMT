import { ModulePlaceholder } from '@/components/module-placeholder';
import { FleetAssistant } from '@/components/fleet-assistant';
import { VehicleRequestReport } from '@/components/vehicle-request-report';
import { MaintenanceWorkspace } from '@/components/maintenance-workspace';
import { FuelWorkspace } from '@/components/fuel-workspace';
import { moduleMetadata } from '@/components/navigation';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

export default async function ModulePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join('/')}`;
  const moduleInfo = moduleMetadata.get(path);

  if (!moduleInfo || path === '/dashboard') notFound();

  if (path === '/analytics/dashboard') redirect('/dashboard');
  if (path === '/analytics/reports') return <Suspense fallback={<div className="panel"><p>Loading reports…</p></div>}><VehicleRequestReport /></Suspense>;
  if (path === '/operations/maintenance') return <MaintenanceWorkspace />;
  if (path === '/operations/fuel-management' || path === '/fuel/operations') return <FuelWorkspace view="operations" />;
  if (path === '/fuel/dashboard') return <FuelWorkspace view="dashboard" />;
  if (path === '/fuel/history') return <FuelWorkspace view="history" />;
  if (path === '/fuel/cards') return <FuelWorkspace view="cards" />;
  if (path === '/fuel/stations') return <FuelWorkspace view="stations" />;
  if (path === '/ai/fleet-optimization') return <FleetAssistant />;

  return (
    <ModulePlaceholder
      title={moduleInfo.title}
      section={moduleInfo.section}
      icon={moduleInfo.icon}
    />
  );
}
