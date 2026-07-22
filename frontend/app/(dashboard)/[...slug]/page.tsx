import { ModulePlaceholder } from '@/components/module-placeholder';
import { FleetAssistant } from '@/components/fleet-assistant';
import { VehicleRequestReport } from '@/components/vehicle-request-report';
import { moduleMetadata } from '@/components/navigation';
import { notFound, redirect } from 'next/navigation';

export default async function ModulePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join('/')}`;
  const moduleInfo = moduleMetadata.get(path);

  if (!moduleInfo || path === '/dashboard') notFound();

  if (path === '/analytics/dashboard') redirect('/dashboard');
  if (path === '/analytics/reports') return <VehicleRequestReport />;
  if (path === '/ai/fleet-optimization') return <FleetAssistant />;

  return (
    <ModulePlaceholder
      title={moduleInfo.title}
      section={moduleInfo.section}
      icon={moduleInfo.icon}
    />
  );
}
