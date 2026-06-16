import { render, screen } from '@testing-library/react';
import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
  useWalletConnection,
} from '@mysten/dapp-kit-react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers';

function DAppKitHookSmoke() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const network = useCurrentNetwork();
  const walletConnection = useWalletConnection();

  return (
    <div>
      <span data-testid="dapp-kit-network">{network}</span>
      <span data-testid="dapp-kit-account">{account === null ? 'no-account' : 'connected'}</span>
      <span data-testid="dapp-kit-client">{client === undefined ? 'no-client' : 'client'}</span>
      <span data-testid="dapp-kit-instance">
        {dAppKit === undefined ? 'no-dapp-kit' : 'dapp-kit'}
      </span>
      <span data-testid="dapp-kit-wallet-status">{walletConnection.status}</span>
    </div>
  );
}

describe('App shell', () => {
  it('renders the PredictPilot foundation shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeInTheDocument();
    expect(screen.getByText('Vite + React + TypeScript')).toBeInTheDocument();
  });

  it('provides DApp Kit hooks to child components on Testnet', () => {
    render(
      <AppProviders>
        <DAppKitHookSmoke />
      </AppProviders>,
    );

    expect(screen.getByTestId('dapp-kit-network')).toHaveTextContent('testnet');
    expect(screen.getByTestId('dapp-kit-account')).toHaveTextContent('no-account');
    expect(screen.getByTestId('dapp-kit-client')).toHaveTextContent('client');
    expect(screen.getByTestId('dapp-kit-instance')).toHaveTextContent('dapp-kit');
    expect(screen.getByTestId('dapp-kit-wallet-status')).toHaveTextContent('disconnected');
  });
});
