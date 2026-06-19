import type { AppRoute } from '@/app/routes';

interface ExecutionReadinessProps {
  activeRoute: AppRoute;
}

const readinessChecks = ['Preview gate', 'Simulation ready', 'Refresh after digest'] as const;

export function ExecutionReadiness({ activeRoute }: ExecutionReadinessProps) {
  return (
    <section
      aria-label="Execution readiness"
      className="border-l border-[#c8d3ce] bg-white/60 pl-3 text-xs text-[#354842]"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold uppercase tracking-[0.12em] text-[#52615c]">
            Execution readiness
          </p>
          <span className="border border-[#d9dfdc] bg-white px-1.5 py-0.5 font-semibold text-[#315447]">
            Guarded wallet execution
          </span>
          <h2 className="font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
        </div>

        <p className="truncate leading-4 text-[#52615c]">{activeRoute.railDescription}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <ul aria-label="Safety gates" className="flex flex-wrap gap-1.5">
            {readinessChecks.map((check) => (
              <li
                className="flex items-center gap-1.5 border border-[#d9dfdc] bg-white px-1.5 py-0.5 leading-3 text-[#445750]"
                key={check}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-[#6c8f82]" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
          <p className="border border-[#e4c77f] bg-[#fffaf0] px-1.5 py-0.5 leading-3 text-[#6b562b]">
            dUSDC needed
          </p>
        </div>
      </div>
    </section>
  );
}
