import { predictDeploymentConfig } from '@/config/predict';
import { suiConfig } from '@/config/sui';
import { WalletPanel } from '@/features/wallet/WalletPanel';
import type { AppRoute } from '@/app/routes';

interface TopBarProps {
  activeRoute: AppRoute;
}

export function TopBar({ activeRoute }: TopBarProps) {
  const statusItems = [
    { label: 'Network', value: `Sui ${suiConfig.network}` },
    { label: 'Oracle feed', value: 'Ready for focused polling' },
    { label: 'Predict server', value: 'Configured' },
    { label: 'Manager', value: 'Discovery pending' },
    { label: 'Quote', value: predictDeploymentConfig.quoteAsset.symbol },
    { label: 'Alerts', value: '0 open' },
  ] as const;

  return (
    <header className="border-b border-[#c8d3ce] bg-white">
      <div className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start lg:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
            PredictPilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[#17211d]">
            DeepBook Predict Terminal
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
            <span className="border border-[#a8b7b0] bg-[#edf5f1] px-2 py-1 text-[#315447]">
              Sui {suiConfig.network}
            </span>
            <span className="border border-[#d5dcd9] bg-[#f7f9fb] px-2 py-1 text-[#52615c]">
              {activeRoute.title}
            </span>
            <span className="border border-[#d5dcd9] bg-[#f7f9fb] px-2 py-1 text-[#52615c]">
              Live terminal
            </span>
          </div>
          <dl
            aria-label="Terminal status strip"
            className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-6"
          >
            {statusItems.map((item) => (
              <div className="border border-[#d9dfdc] bg-[#fbfcfc] px-3 py-2" key={item.label}>
                <dt className="font-semibold uppercase tracking-[0.1em] text-[#64736e]">
                  {item.label}
                </dt>
                <dd className="mt-1 break-words font-medium text-[#17211d]">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <WalletPanel />
      </div>
    </header>
  );
}
