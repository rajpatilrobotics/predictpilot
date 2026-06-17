import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
  useWalletConnection,
} from '@mysten/dapp-kit-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { appRoutes, resolveAppRoute } from '@/app/routes';
import { AppProviders } from '@/app/providers';
import { RouteLoadingState } from '@/components/layout/RouteStates';

vi.mock('@mysten/dapp-kit-react/ui', () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

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

function renderAppAt(pathname: string = '/dashboard') {
  window.history.pushState({}, '', pathname);

  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('App shell', () => {
  it('renders the terminal shell with navigation, wallet status, and Testnet indicator', () => {
    renderAppAt('/dashboard');

    expect(screen.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Mobile navigation/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Wallet status')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal status strip')).toBeInTheDocument();
    expect(screen.getByText('Ready for focused polling')).toBeInTheDocument();
    expect(screen.getByText('Discovery pending')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Testnet status/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Persistent execution rail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('navigates between shell routes without full feature screens', () => {
    renderAppAt('/dashboard');
    const primaryNav = screen.getByRole('navigation', { name: /Primary navigation/i });

    fireEvent.click(within(primaryNav).getByRole('link', { name: 'Markets' }));
    expect(screen.getByRole('heading', { name: 'Markets' })).toBeInTheDocument();
    expect(screen.getAllByText('Shell only').length).toBeGreaterThan(0);

    fireEvent.click(within(primaryNav).getByRole('link', { name: 'Vault / PLP' }));
    expect(screen.getByRole('heading', { name: 'Vault / PLP' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vault actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Persistent execution rail')).toBeInTheDocument();
  });

  it('resolves every approved PP-040 route placeholder', () => {
    for (const route of appRoutes) {
      window.history.pushState({}, '', route.href);
      const { unmount } = render(
        <AppProviders>
          <App />
        </AppProviders>,
      );

      expect(screen.getByRole('heading', { name: route.title })).toBeInTheDocument();
      expect(screen.getByLabelText(`${route.title} route placeholder`)).toBeInTheDocument();
      expect(screen.getByText(route.focus)).toBeInTheDocument();
      unmount();
    }
  });

  it('resolves market-detail and oracle aliases', () => {
    expect(resolveAppRoute('/markets/0x123').id).toBe('market-detail');
    expect(resolveAppRoute('/svi').id).toBe('svi');
    expect(resolveAppRoute('/oracle-status').id).toBe('oracle-status');
    expect(resolveAppRoute('/oracle').id).toBe('oracle-status');
  });

  it('renders distinct PP-040 placeholders for SVI, oracle status, and PnL', () => {
    const distinctRoutes = [
      { path: '/svi', title: 'SVI Surface', railTitle: 'SVI context' },
      { path: '/oracle-status', title: 'Oracle Status', railTitle: 'Oracle status' },
      { path: '/pnl', title: 'PnL', railTitle: 'PnL context' },
    ] as const;

    for (const route of distinctRoutes) {
      window.history.pushState({}, '', route.path);
      const { unmount } = render(
        <AppProviders>
          <App />
        </AppProviders>,
      );

      expect(screen.getByRole('heading', { name: route.title })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: route.railTitle })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders a route error state for unknown paths', () => {
    renderAppAt('/not-a-real-route');

    expect(screen.getByRole('alert', { name: /Route error state/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Route not found/i })).toBeInTheDocument();
  });

  it('renders the required five-tab mobile navigation labels', () => {
    renderAppAt('/dashboard');
    const mobileNav = screen.getByRole('navigation', { name: /Mobile navigation/i });

    expect(within(mobileNav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Markets' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Build' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Portfolio' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Demo' })).toBeInTheDocument();
  });

  it('provides a reusable route loading state', () => {
    render(<RouteLoadingState />);

    expect(screen.getByRole('status', { name: /Route loading state/i })).toBeInTheDocument();
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
