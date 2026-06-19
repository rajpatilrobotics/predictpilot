import { predictDeploymentConfig } from '@/config/predict';
import { suiConfig } from '@/config/sui';
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
      className="border border-[#c8d3ce] bg-[#fbfcfc] p-3 text-sm text-[#354842] shadow-sm"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)_minmax(320px,1fr)] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52615c]">
            Execution readiness
          </p>
          <h2 className="mt-1 text-base font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
          <p className="mt-1 leading-6 text-[#52615c]">{activeRoute.railDescription}</p>
        </div>

        <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <ReadinessDatum label="Network" value={suiConfig.network} />
          <ReadinessDatum label="Quote" value={predictDeploymentConfig.quoteAsset.symbol} />
          <ReadinessDatum label="Mode" value="Guarded wallet execution" />
        </dl>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] lg:grid-cols-1">
          <div className="border border-[#d9dfdc] bg-white px-3 py-2">
            <p className="font-semibold text-[#17211d]">Safety gates</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {readinessChecks.map((check) => (
                <li className="flex gap-2 text-xs leading-5 text-[#445750]" key={check}>
                  <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 bg-[#6c8f82]" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="border border-[#e0c891] bg-[#fff9ea] px-3 py-2 text-xs leading-5 text-[#5c4720]">
            Actions open a pre-sign review first. Funding and live dUSDC are required before real
            Testnet proof.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReadinessDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-white px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[#17211d]">{value}</dd>
    </div>
  );
}
