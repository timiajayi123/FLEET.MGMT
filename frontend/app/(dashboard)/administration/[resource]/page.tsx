import { MasterDataAdmin } from '@/components/master-data-admin';
import { isMasterDataResource, masterDataResources } from '@/components/master-data-config';
import { notFound } from 'next/navigation';
import { UsersAdmin } from '@/components/users-admin';

export default async function MasterDataPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (resource === 'users') return <UsersAdmin />;
  if (!isMasterDataResource(resource)) notFound();

  return <MasterDataAdmin resource={resource} config={masterDataResources[resource]} />;
}
