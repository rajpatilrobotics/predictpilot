import type { ReactNode } from 'react';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';

interface NetworkGuardProps {
  children: ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const walletStatus = useWalletStatus();

  if (!walletStatus.isWrongNetwork) {
    return <>{children}</>;
  }

  return (
    <section
      aria-label="Wrong network"
      className="rounded border border-[#bd6f53] bg-[#fff4ef] p-4 text-sm text-[#563023]"
      role="alert"
    >
      <p className="font-semibold text-[#3c1f16]">Wrong network</p>
      <p className="mt-2">
        PredictPilot can only continue on {walletStatus.expectedNetwork}. Your current network is{' '}
        {walletStatus.currentNetwork}.
      </p>
      <p className="mt-3 font-medium">Switch to Testnet, then refresh this view if needed.</p>
    </section>
  );
}
