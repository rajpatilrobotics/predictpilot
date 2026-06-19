import { WalletButton } from '@/features/wallet/WalletButton';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';

interface WalletPanelProps {
  variant?: 'card' | 'compact';
}

export function WalletPanel({ variant = 'card' }: WalletPanelProps) {
  const walletStatus = useWalletStatus();

  if (variant === 'compact') {
    return <CompactWalletPanel walletStatus={walletStatus} />;
  }

  return (
    <aside
      aria-label="Wallet status"
      className={`w-full rounded border bg-white px-4 py-3 text-sm text-[#243832] shadow-sm lg:max-w-md ${
        walletStatus.isWrongNetwork ? 'border-[#bd6f53]' : 'border-[#c8d3ce]'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#446b5e]">Wallet</p>
          <p className="mt-1 font-semibold text-[#17211d]">
            {walletStatus.walletName ?? 'No wallet connected'}
          </p>
        </div>
        <WalletButton />
      </div>

      <dl className="mt-3 grid gap-2 border-t border-[#d9dfdc] pt-3 sm:grid-cols-3">
        <StatusItem compact label="Account" value={walletStatus.shortAddress ?? 'Not connected'} />
        <StatusItem
          compact
          label="Network"
          value={
            walletStatus.isExpectedNetwork
              ? walletStatus.currentNetwork
              : `${walletStatus.currentNetwork} (expected ${walletStatus.expectedNetwork})`
          }
        />
        <StatusItem compact label="Status" value={walletStatus.statusLabel} />
      </dl>

      {walletStatus.isWrongNetwork ? (
        <p
          aria-label="Wrong network warning"
          className="mt-3 rounded border border-[#f0c5b6] bg-[#fff4ef] px-3 py-2 text-xs font-medium text-[#6b3b2d]"
          role="alert"
        >
          Wrong network. Switch to Testnet before using any execution flow.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-[#5d6b66]" aria-live="polite">
        {walletStatus.isConnected
          ? `${walletStatus.supportedIntentsCount} wallet intent${walletStatus.supportedIntentsCount === 1 ? '' : 's'} available.`
          : 'Connect a Sui wallet to continue on Testnet.'}
      </p>
    </aside>
  );
}

type WalletStatus = ReturnType<typeof useWalletStatus>;

function CompactWalletPanel({ walletStatus }: { walletStatus: WalletStatus }) {
  return (
    <aside
      aria-label="Wallet status"
      className={`w-full rounded-sm border bg-white/80 px-2.5 py-1.5 text-xs text-[#243832] shadow-sm lg:max-w-[340px] ${
        walletStatus.isWrongNetwork ? 'border-[#bd6f53]' : 'border-[#c8d3ce]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#446b5e]">
            Wallet
          </p>
          <p className="truncate text-[0.78rem] font-semibold text-[#17211d]">
            {walletStatus.walletName ?? 'No wallet connected'}
          </p>
        </div>
        <div className="shrink-0">
          <WalletButton />
        </div>
      </div>

      <dl className="mt-1.5 grid gap-x-2 gap-y-0.5 border-t border-[#d9dfdc] pt-1.5 sm:grid-cols-3">
        <StatusItem label="Account" value={walletStatus.shortAddress ?? 'Not connected'} />
        <StatusItem
          label="Network"
          value={
            walletStatus.isExpectedNetwork
              ? walletStatus.currentNetwork
              : `${walletStatus.currentNetwork} (expected ${walletStatus.expectedNetwork})`
          }
        />
        <StatusItem label="Status" value={walletStatus.statusLabel} />
      </dl>

      {walletStatus.isWrongNetwork ? (
        <p
          aria-label="Wrong network warning"
          className="mt-1.5 rounded-sm border border-[#f0c5b6] bg-[#fff4ef] px-2 py-1 font-medium text-[#6b3b2d]"
          role="alert"
        >
          Wrong network. Switch to Testnet before using any execution flow.
        </p>
      ) : null}

      <p className="mt-1.5 truncate text-[#5d6b66]" aria-live="polite">
        {walletStatus.isConnected
          ? `${walletStatus.supportedIntentsCount} wallet intent${walletStatus.supportedIntentsCount === 1 ? '' : 's'} available.`
          : 'Connect a Sui wallet to continue on Testnet.'}
      </p>
    </aside>
  );
}

interface StatusItemProps {
  compact?: boolean;
  label: string;
  value: string;
}

function StatusItem({ compact = false, label, value }: StatusItemProps) {
  return (
    <div>
      <dt
        className={`uppercase tracking-[0.08em] text-[#5d6b66] ${
          compact ? 'text-[0.66rem]' : 'text-xs'
        }`}
      >
        {label}
      </dt>
      <dd
        className={`break-words font-medium text-[#17211d] ${
          compact ? 'mt-0.5 text-[0.74rem]' : 'mt-1'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
