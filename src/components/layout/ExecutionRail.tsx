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
      className="border border-[#c8d3ce] bg-[#fbfcfc] px-3 py-2 text-sm text-[#354842] shadow-sm"
    >
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52615c]">
              Execution readiness
            </p>
            <span className="border border-[#d9dfdc] bg-white px-2 py-0.5 text-xs font-semibold text-[#315447]">
              Guarded wallet execution
            </span>
          </div>
          <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3">
            <h2 className="text-base font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
            <p className="max-w-4xl leading-6 text-[#52615c]">{activeRoute.railDescription}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:items-end">
          <ul aria-label="Safety gates" className="flex flex-wrap gap-2">
            {readinessChecks.map((check) => (
              <li
                className="flex items-center gap-2 border border-[#d9dfdc] bg-white px-2 py-1 text-xs leading-5 text-[#445750]"
                key={check}
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-[#6c8f82]" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-[#6b562b]">
            Funding and live dUSDC required before real Testnet proof.
          </p>
        </div>
      </div>
    </section>
  );
}
