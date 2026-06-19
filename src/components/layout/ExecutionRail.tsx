import { predictDeploymentConfig } from '@/config/predict';
import { suiConfig } from '@/config/sui';
import type { AppRoute } from '@/app/routes';

interface ExecutionRailProps {
  activeRoute: AppRoute;
}

const railChecks = [
  'Preview required before signing',
  'Simulation boundary available',
  'Post-transaction refresh after digest',
] as const;

export function ExecutionRail({ activeRoute }: ExecutionRailProps) {
  return (
    <aside
      aria-label="Persistent execution rail"
      className="hidden min-w-0 border border-[#c8d3ce] bg-[#fbfcfc] p-4 text-sm text-[#354842] shadow-sm xl:block"
    >
      <div className="border-b border-[#d9dfdc] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52615c]">
          Execution Rail
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[#17211d]">{activeRoute.railTitle}</h2>
        <p className="mt-2 leading-6 text-[#52615c]">{activeRoute.railDescription}</p>
      </div>

      <dl className="mt-4 space-y-3">
        <RailDatum label="Network" value={suiConfig.network} />
        <RailDatum label="Quote" value={predictDeploymentConfig.quoteAsset.symbol} />
        <RailDatum label="Mode" value="Guarded wallet execution" />
      </dl>

      <div className="mt-4 border border-[#d9dfdc] bg-white p-3">
        <p className="font-semibold text-[#17211d]">Safety gates</p>
        <ul className="mt-3 space-y-2">
          {railChecks.map((check) => (
            <li className="flex gap-2 text-xs leading-5 text-[#445750]" key={check}>
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 bg-[#6c8f82]" />
              <span>{check}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 border border-[#e0c891] bg-[#fff9ea] p-3 text-xs leading-5 text-[#5c4720]">
        Actions open a pre-sign review first. Funding and live dUSDC are still required before real
        Testnet proof.
      </p>
    </aside>
  );
}

function RailDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[#17211d]">{value}</dd>
    </div>
  );
}
