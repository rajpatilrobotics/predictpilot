import type { AppRoute } from '@/app/routes';

interface ExecutionReadinessProps {
  activeRoute: AppRoute;
}

const readinessChecks = ['Pre-sign review', 'Simulation', 'Refresh after digest'] as const;

export function ExecutionReadiness({ activeRoute }: ExecutionReadinessProps) {
  return (
    <section aria-label="Execution readiness" className="text-xs text-[#354842]">
      <div className="min-w-0 border-l border-[#c8d3ce] pl-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="font-semibold uppercase tracking-[0.12em] text-[#52615c]">Current page</p>
          <h2 className="font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
        </div>

        <p className="mt-1 line-clamp-2 leading-4 text-[#52615c] lg:truncate">
          {activeRoute.railDescription}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] leading-4">
          <p aria-label="Safety gates" className="font-medium text-[#445750]">
            {readinessChecks.join(' · ')}
          </p>
          <span className="rounded-sm border border-[#e4c77f] bg-[#fffaf0] px-1.5 py-0.5 font-medium text-[#6b562b]">
            dUSDC needed
          </span>
        </div>
      </div>
    </section>
  );
}
