import { ConnectButton } from '@mysten/dapp-kit-react/ui';

export function WalletButton() {
  return (
    <div className="wallet-connect-button" aria-label="Sui wallet connection">
      <ConnectButton />
    </div>
  );
}
