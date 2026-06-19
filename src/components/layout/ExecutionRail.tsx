import type { AppRoute } from '@/app/routes';

interface ExecutionReadinessProps {
  activeRoute: AppRoute;
}

const readinessChecks = [
  'Preview required before signing',
  'Simulation boundary available',
  'Post-transaction refresh after digest',
] as const;

export function ExecutionReadiness({ activeRoute }: ExecutionReadinessProps) {
  return (
    <section
      aria-label="Execution readiness"
      className="border border-[#c8d3ce] bg-[#fbfcfc] px-2 py-1 text-xs text-[#354842] shadow-sm"
    >
      <div className="flex flex-col gap-1 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold uppercase tracking-[0.14em] text-[#52615c]">
            Execution readiness
          </p>
          <span className="border border-[#d9dfdc] bg-white px-1.5 py-0.5 font-semibold text-[#315447]">
            Guarded wallet execution
          </span>
          <h2 className="font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
          <p className="min-w-0 max-w-3xl truncate leading-5 text-[#52615c]">
            {activeRoute.railDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
          <ul aria-label="Safety gates" className="flex flex-wrap gap-1.5">
            {readinessChecks.map((check) => (
              <li
                className="flex items-center gap-1.5 border border-[#d9dfdc] bg-white px-1.5 py-0.5 leading-5 text-[#445750]"
                key={check}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-[#6c8f82]" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
          <p className="border border-[#e5cf94] bg-[#fff8e8] px-1.5 py-0.5 leading-5 text-[#6b562b]">
            dUSDC funding required
          </p>
        </div>
      </div>
    </section>
  );
}
