import { ReactNode } from 'react';
import { Breadcrumbs } from './breadcrumbs';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <Breadcrumbs />
      <header className="content-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
    </>
  );
}
