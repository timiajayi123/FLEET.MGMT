import { ArrowRight, LucideIcon } from 'lucide-react';
import { PageHeader } from './page-header';

export function ModulePlaceholder({
  title,
  section,
  icon: Icon,
}: {
  title: string;
  section: string;
  icon: LucideIcon;
}) {
  return (
    <>
      <PageHeader title={title} description={`${section} workspace for NMDPRA fleet operations.`} />
      <section className="empty-module">
        <div className="empty-icon">
          <Icon size={28} />
        </div>
        <span className="section-chip">{section}</span>
        <h2>{title} module</h2>
        <p>
          This workspace is ready for its approved workflows, records, permissions, and reporting
          requirements.
        </p>
        <div className="empty-roadmap">
          <span>UI shell ready</span>
          <ArrowRight size={15} />
          <span>Business workflow pending</span>
        </div>
      </section>
    </>
  );
}
