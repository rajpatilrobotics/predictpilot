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

vi.mock('@/features/dashboard/DashboardPage', () => ({
  DashboardPage: () => (
    <article aria-label="Dashboard page">
      <h1>Dashboard</h1>
      <p>Dashboard page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/markets/MarketIntelligencePage', () => ({
  MarketIntelligencePage: () => (
    <article aria-label="Market intelligence page">
      <h1>Markets</h1>
      <p>Market intelligence page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/oracle/OracleStatusPage', () => ({
  OracleStatusPage: () => (
    <article aria-label="Oracle status page">
      <h1>Oracle Status</h1>
      <p>Oracle status page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/oracle/SVISurfacePage', () => ({
  SVISurfacePage: () => (
    <article aria-label="SVI surface page">
      <h1>SVI Surface</h1>
      <p>SVI surface page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/portfolio/PortfolioPage', () => ({
  PortfolioPage: () => (
    <article aria-label="Portfolio page">
      <h1>Portfolio</h1>
      <p>Portfolio page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/portfolio/PnlPage', () => ({
  PnlPage: () => (
    <article aria-label="PnL page">
      <h1>PnL</h1>
      <p>PnL page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/history/HistoryPage', () => ({
  HistoryPage: () => (
    <article aria-label="History page">
      <h1>History</h1>
      <p>History page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/vault/VaultPage', () => ({
  VaultPage: () => (
    <article aria-label="Vault page">
      <h1>Vault / PLP</h1>
      <p>Vault page mounted</p>
    </article>
  ),
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

  it('navigates between shell routes and mounts implemented pages', () => {
    renderAppAt('/dashboard');
    const primaryNav = screen.getByRole('navigation', { name: /Primary navigation/i });

    fireEvent.click(within(primaryNav).getByRole('link', { name: 'Markets' }));
    expect(screen.getByRole('heading', { name: 'Markets' })).toBeInTheDocument();
    expect(screen.getByText('Market intelligence page mounted')).toBeInTheDocument();
    expect(screen.getAllByText('Shell only').length).toBeGreaterThan(0);

    fireEvent.click(within(primaryNav).getByRole('link', { name: 'Vault / PLP' }));
    expect(screen.getByRole('heading', { name: 'Vault / PLP' })).toBeInTheDocument();
    expect(screen.getByText('Vault page mounted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vault actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Persistent execution rail')).toBeInTheDocument();
  });

  it('mounts implemented Phase 5 route pages inside the shared shell', () => {
    const mountedRouteTextById = {
      dashboard: 'Dashboard page mounted',
      history: 'History page mounted',
      markets: 'Market intelligence page mounted',
      'oracle-status': 'Oracle status page mounted',
      pnl: 'PnL page mounted',
      portfolio: 'Portfolio page mounted',
      svi: 'SVI surface page mounted',
      vault: 'Vault page mounted',
    } as const;

    for (const route of appRoutes.filter((item) => item.id in mountedRouteTextById)) {
      window.history.pushState({}, '', route.href);
      const { unmount } = render(
        <AppProviders>
          <App />
        </AppProviders>,
      );

      expect(screen.getByRole('heading', { name: route.title })).toBeInTheDocument();
      expect(
        screen.getByText(mountedRouteTextById[route.id as keyof typeof mountedRouteTextById]),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(`${route.title} route placeholder`)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('keeps unimplemented routes as safe placeholders', () => {
    const placeholderRouteIds = new Set(['demo', 'manager', 'strategy']);

    for (const route of appRoutes.filter((item) => placeholderRouteIds.has(item.id))) {
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

  it('renders distinct Phase 5 pages for SVI, oracle status, and PnL', () => {
    const distinctRoutes = [
      { mountedText: 'SVI surface page mounted', path: '/svi', title: 'SVI Surface', railTitle: 'SVI context' },
      { mountedText: 'Oracle status page mounted', path: '/oracle-status', title: 'Oracle Status', railTitle: 'Oracle status' },
      { mountedText: 'PnL page mounted', path: '/pnl', title: 'PnL', railTitle: 'PnL context' },
    ] as const;

    for (const route of distinctRoutes) {
      window.history.pushState({}, '', route.path);
      const { unmount } = render(
        <AppProviders>
          <App />
        </AppProviders>,
      );

      expect(screen.getByRole('heading', { name: route.title })).toBeInTheDocument();
      expect(screen.getByText(route.mountedText)).toBeInTheDocument();
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
