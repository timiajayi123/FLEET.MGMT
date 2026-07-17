import { ModulePlaceholder } from '@/components/module-placeholder';
import { moduleMetadata } from '@/components/navigation';
import { notFound } from 'next/navigation';

export default async function ModulePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join('/')}`;
  const moduleInfo = moduleMetadata.get(path);

  if (!moduleInfo || path === '/dashboard') notFound();

  return (
    <ModulePlaceholder
      title={moduleInfo.title}
      section={moduleInfo.section}
      icon={moduleInfo.icon}
    />
  );
}
