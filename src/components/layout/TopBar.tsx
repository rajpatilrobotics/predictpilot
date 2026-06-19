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
    <header className="border-b border-[#c8d3ce] bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              PredictPilot
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[#17211d]">
              DeepBook Predict Terminal
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
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
            <dl aria-label="Terminal status strip" className="mt-3 flex flex-wrap gap-2 text-xs">
              {statusItems.map((item) => (
                <div
                  className="flex min-h-10 items-center gap-2 border border-[#d9dfdc] bg-[#fbfcfc] px-2.5 py-1.5"
                  key={item.label}
                >
                  <dt className="font-semibold uppercase tracking-[0.1em] text-[#64736e]">
                    {item.label}
                  </dt>
                  <dd className="font-medium text-[#17211d]">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Suspense fallback={<WalletPanelLoadingState />}>
            <WalletPanel />
          </Suspense>
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
      className="w-full rounded border border-[#c8d3ce] bg-white px-4 py-3 text-sm text-[#243832] shadow-sm lg:max-w-md"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#446b5e]">Wallet</p>
          <p className="mt-1 font-semibold text-[#17211d]">Loading wallet runtime</p>
        </div>
        <span className="border border-[#b8c6c0] bg-[#eef3f1] px-4 py-2 text-sm font-semibold text-[#243832]">
          Connect Wallet
        </span>
      </div>
      <dl className="mt-3 grid gap-2 border-t border-[#d9dfdc] pt-3 sm:grid-cols-3">
        <WalletPanelFallbackItem label="Account" value="Pending" />
        <WalletPanelFallbackItem label="Network" value={suiConfig.network} />
        <WalletPanelFallbackItem label="Status" value="Loading" />
      </dl>
    </aside>
  );
}

function WalletPanelFallbackItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[#5d6b66]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#17211d]">{value}</dd>
    </div>
  );
}
