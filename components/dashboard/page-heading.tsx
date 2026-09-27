import type { DashboardSection } from '@/lib/dashboard/types';
import { pageMeta } from '@/lib/dashboard/config';
export function PageHeading({ section }: { section: DashboardSection }) {
  const meta = pageMeta[section];
  return (
    <section className="page-heading">
      <div>
        <div className="breadcrumb">
          KOL GIA <span>/</span> {meta.title}
        </div>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
    </section>
  );
}
