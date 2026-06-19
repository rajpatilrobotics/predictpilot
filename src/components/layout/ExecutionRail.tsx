import type { AppRoute } from '@/app/routes';

interface ExecutionReadinessProps {
  activeRoute: AppRoute;
  metaItems?: readonly ReadinessMetaItem[];
}

interface ReadinessMetaItem {
  label: string;
  value: string;
}

const readinessChecks = ['Preview required', 'Simulation ready', 'Refresh after digest'] as const;

export function ExecutionReadiness({ activeRoute, metaItems = [] }: ExecutionReadinessProps) {
  return (
    <section aria-label="Execution readiness" className="text-xs text-[#354842]">
      <div className="min-w-0 border-l border-[#c8d3ce] pl-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="font-semibold uppercase tracking-[0.12em] text-[#52615c]">
            Execution readiness
          </p>
          <h2 className="font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
          <span className="rounded-sm border border-[#d9dfdc] bg-[#f8fbf9] px-1.5 py-0.5 font-semibold text-[#315447]">
            Guarded wallet execution
          </span>
        </div>

        <p className="mt-1 truncate leading-4 text-[#52615c]">{activeRoute.railDescription}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] leading-4">
          <p aria-label="Safety gates" className="font-medium text-[#445750]">
            {readinessChecks.join(' · ')}
          </p>
          <span className="rounded-sm border border-[#e4c77f] bg-[#fffaf0] px-1.5 py-0.5 font-medium text-[#6b562b]">
            dUSDC needed
          </span>
        </div>

        {metaItems.length > 0 ? <ReadinessMetaList items={metaItems} /> : null}
      </div>
    </section>
  );
}

function ReadinessMetaList({ items }: { items: readonly ReadinessMetaItem[] }) {
  return (
    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.66rem] leading-4 text-[#64736e]">
      {items.map((item) => (
        <div className="flex min-w-0 items-baseline gap-1" key={item.label}>
          <dt className="shrink-0 uppercase tracking-[0.08em]">{item.label}</dt>
          <dd className="truncate font-medium text-[#354842]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
