import { lazy, Suspense } from 'react';
import { predictDeploymentConfig } from '@/config/predict';
import { suiConfig } from '@/config/sui';
import { ExecutionReadiness } from '@/components/layout/ExecutionRail';
import type { AppRoute } from '@/app/routes';

const WalletPanel = lazy(async () => ({
  default: (await import('@/features/wallet/WalletPanel')).WalletPanel,
}));

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
    <header className="sticky top-0 z-50 border-b border-[#c8d3ce] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-1 px-4 py-1.5 lg:px-6">
        <div className="flex flex-col gap-1 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              PredictPilot
            </span>
            <h1 className="truncate text-base font-semibold tracking-normal text-[#17211d]">
              DeepBook Predict Terminal
            </h1>
            <span className="border border-[#a8b7b0] bg-[#edf5f1] px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#315447]">
              Sui {suiConfig.network}
            </span>
            <span className="border border-[#d5dcd9] bg-[#f7f9fb] px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#52615c]">
              {activeRoute.title}
            </span>
            <span className="border border-[#d5dcd9] bg-[#f7f9fb] px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#52615c]">
              Live terminal
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1 xl:flex-row xl:items-center xl:justify-end">
            <dl
              aria-label="Terminal status strip"
              className="flex min-w-0 flex-wrap gap-1 text-[0.68rem]"
            >
              {statusItems.map((item) => (
                <div
                  className="flex min-h-6 items-center gap-1 border border-[#d9dfdc] bg-[#fbfcfc] px-1.5 py-0.5"
                  key={item.label}
                >
                  <dt className="font-semibold uppercase tracking-[0.1em] text-[#64736e]">
                    {item.label}
                  </dt>
                  <dd className="truncate font-medium text-[#17211d]">{item.value}</dd>
                </div>
              ))}
            </dl>

            <Suspense fallback={<WalletPanelLoadingState />}>
              <WalletPanel variant="compact" />
            </Suspense>
          </div>
        </div>
        <ExecutionReadiness activeRoute={activeRoute} />
      </div>
    </header>
  );
}

function WalletPanelLoadingState() {
  return (
    <aside
      aria-label="Wallet status"
      className="flex min-w-0 flex-wrap items-center gap-2 border border-[#c8d3ce] bg-white px-2 py-1 text-xs text-[#243832] shadow-sm"
      role="status"
    >
      <div>
        <p className="font-semibold uppercase tracking-[0.12em] text-[#446b5e]">Wallet</p>
        <p className="font-semibold text-[#17211d]">Loading wallet runtime</p>
      </div>
      <span className="ml-auto border border-[#b8c6c0] bg-[#eef3f1] px-2 py-1 font-semibold text-[#243832]">
        Connect Wallet
      </span>
      <dl className="flex basis-full flex-wrap gap-x-3 gap-y-1">
        <WalletPanelFallbackItem label="Account" value="Pending" />
        <WalletPanelFallbackItem label="Network" value={suiConfig.network} />
        <WalletPanelFallbackItem label="Status" value="Loading" />
      </dl>
    </aside>
  );
}

function WalletPanelFallbackItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-[#5d6b66]">{label}</dt>
      <dd className="font-medium text-[#17211d]">{value}</dd>
    </div>
  );
}
