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
  const statusText = [
    `Testnet`,
    predictDeploymentConfig.quoteAsset.symbol,
    'Manager pending',
    '0 alerts',
  ].join(' · ');

  return (
    <header className="sticky top-0 z-50 border-b border-[#c8d3ce] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-2 lg:px-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(300px,430px)_minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              PredictPilot
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[#17211d]">
              DeepBook Predict Terminal
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
              <span className="border border-[#a8b7b0] bg-[#edf5f1] px-2 py-0.5 text-[#315447]">
                Sui {suiConfig.network}
              </span>
              <span className="border border-[#d5dcd9] bg-[#f7f9fb] px-2 py-0.5 text-[#52615c]">
                Live terminal
              </span>
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p
              aria-label="Terminal status strip"
              className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#64736e] lg:text-right"
            >
              {statusText}
            </p>
            <ExecutionReadiness activeRoute={activeRoute} />
          </div>

          <Suspense fallback={<WalletPanelLoadingState />}>
            <WalletPanel variant="compact" />
          </Suspense>
        </div>
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
