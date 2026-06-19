import { WalletButton } from '@/features/wallet/WalletButton';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';

export function WalletPanel() {
  const walletStatus = useWalletStatus();

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

interface StatusItemProps {
  label: string;
  value: string;
}

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[#5d6b66]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#17211d]">{value}</dd>
    </div>
  );
}
