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
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
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

vi.mock('@/features/demo/DemoModePage', () => ({
  DemoModePage: () => (
    <article aria-label="Demo mode page">
      <h1>Demo Mode</h1>
      <p>Demo mode page mounted</p>
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

vi.mock('@/features/manager/PredictManagerPage', () => ({
  PredictManagerPage: () => (
    <article aria-label="PredictManager page">
      <h1>PredictManager</h1>
      <p>PredictManager page mounted</p>
    </article>
  ),
}));

vi.mock('@/features/oracle/OracleStatusPage', () => ({
  OracleStatusPage: ({ oracleId }: { oracleId?: string }) => (
    <article aria-label="Oracle status page">
      <h1>Oracle Status</h1>
      <p>Oracle status page mounted</p>
      {oracleId === undefined ? null : <p>Oracle status selected {oracleId}</p>}
    </article>
  ),
}));

vi.mock('@/features/oracle/SVISurfacePage', () => ({
  SVISurfacePage: ({ oracleId }: { oracleId?: string }) => (
    <article aria-label="SVI surface page">
      <h1>SVI Surface</h1>
      <p>SVI surface page mounted</p>
      {oracleId === undefined ? null : <p>SVI selected {oracleId}</p>}
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

vi.mock('@/features/trade/MarketDetailPage', () => ({
  MarketDetailPage: ({ oracleId }: { oracleId?: string | null }) => (
    <article aria-label="Market detail strategy page">
      <h1>Market Detail / Strategy</h1>
      <p>{oracleId === undefined ? 'Strategy route mounted' : 'Market detail page mounted'}</p>
      {oracleId === undefined ? null : <p>{oracleId}</p>}
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

const appShellWaitOptions = { timeout: 5_000 };

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

function BrokenRouteSurface(): null {
  throw new Error('Simulated lazy route failure');
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
  it('renders the terminal shell with navigation, wallet status, and Testnet indicator', async () => {
    renderAppAt('/dashboard');

    expect(
      await screen.findByRole(
        'heading',
        { name: /DeepBook Predict Terminal/i },
        appShellWaitOptions,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Mobile navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to route content' })).toHaveAttribute(
      'href',
      '#route-content',
    );
    expect(screen.getByRole('main', { name: 'Route content' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByLabelText('Wallet status')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal status strip')).toBeInTheDocument();
    expect(screen.getByText(/Testnet · DUSDC · Manager pending · 0 alerts/i)).toBeInTheDocument();
    expect(screen.getByText('Current page')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Testnet status/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Execution readiness')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('navigates between shell routes and mounts implemented pages', async () => {
    renderAppAt('/dashboard');
    const primaryNav = await screen.findByRole('navigation', { name: /Primary navigation/i });

    fireEvent.click(within(primaryNav).getByRole('link', { name: 'Markets' }));
    expect(await screen.findByRole('heading', { name: 'Markets' })).toBeInTheDocument();
    expect(await screen.findByText('Market intelligence page mounted')).toBeInTheDocument();
    expect(screen.getAllByText('Live terminal').length).toBeGreaterThan(0);

    fireEvent.click(within(primaryNav).getByRole('link', { name: 'Vault / PLP' }));
    expect(await screen.findByRole('heading', { name: 'Vault / PLP' })).toBeInTheDocument();
    expect(await screen.findByText('Vault page mounted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vault actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Execution readiness')).toBeInTheDocument();
  });

  it('mounts implemented Phase 5 route pages inside the shared shell', async () => {
    const mountedRouteTextById = {
      dashboard: 'Dashboard page mounted',
      demo: 'Demo mode page mounted',
      history: 'History page mounted',
      manager: 'PredictManager page mounted',
      markets: 'Market intelligence page mounted',
      'oracle-status': 'Oracle status page mounted',
      pnl: 'PnL page mounted',
      portfolio: 'Portfolio page mounted',
      strategy: 'Strategy route mounted',
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

      expect(
        await screen.findByRole('heading', { name: route.title }, appShellWaitOptions),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(
          mountedRouteTextById[route.id as keyof typeof mountedRouteTextById],
          {},
          appShellWaitOptions,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(`${route.title} route placeholder`)).not.toBeInTheDocument();
      unmount();
    }
  }, 15_000);

  it('resolves market-detail and oracle aliases', () => {
    expect(resolveAppRoute('/markets/0x123').id).toBe('market-detail');
    expect(resolveAppRoute('/svi').id).toBe('svi');
    expect(resolveAppRoute('/oracle-status').id).toBe('oracle-status');
    expect(resolveAppRoute('/oracle').id).toBe('oracle-status');
  });

  it('mounts dynamic market detail routes inside the shared shell', async () => {
    const oracleId = '0x123';

    renderAppAt(`/markets/${oracleId}`);

    expect(
      await screen.findByRole('heading', { name: 'Market Detail / Strategy' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Market detail page mounted')).toBeInTheDocument();
    expect(await screen.findByText(oracleId)).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Market Detail / Strategy route placeholder'),
    ).not.toBeInTheDocument();
  });

  it('renders distinct Phase 5 pages for SVI, oracle status, and PnL', async () => {
    const distinctRoutes = [
      {
        mountedText: 'SVI surface page mounted',
        path: '/svi',
        title: 'SVI Surface',
        railTitle: 'SVI context',
      },
      {
        mountedText: 'Oracle status page mounted',
        path: '/oracle-status',
        title: 'Oracle Status',
        railTitle: 'Oracle status',
      },
      { mountedText: 'PnL page mounted', path: '/pnl', title: 'PnL', railTitle: 'PnL context' },
    ] as const;

    for (const route of distinctRoutes) {
      window.history.pushState({}, '', route.path);
      const { unmount } = render(
        <AppProviders>
          <App />
        </AppProviders>,
      );

      expect(await screen.findByRole('heading', { name: route.title })).toBeInTheDocument();
      expect(await screen.findByText(route.mountedText)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: route.railTitle })).toBeInTheDocument();
      unmount();
    }
  });

  it('passes query-selected oracle IDs into SVI and oracle status pages', async () => {
    const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d';

    const sviRender = renderAppAt(`/svi?oracleId=${oracleId}`);
    expect(await screen.findByText(`SVI selected ${oracleId}`)).toBeInTheDocument();
    sviRender.unmount();

    const oracleStatusRender = renderAppAt(`/oracle-status?oracleId=${oracleId}`);
    expect(await screen.findByText(`Oracle status selected ${oracleId}`)).toBeInTheDocument();
    oracleStatusRender.unmount();
  });

  it('renders a route error state for unknown paths', () => {
    renderAppAt('/not-a-real-route');

    expect(screen.getByRole('alert', { name: /Route error state/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Route not found/i })).toBeInTheDocument();
  });

  it('renders the required five-tab mobile navigation labels', async () => {
    renderAppAt('/dashboard');
    const mobileNav = screen.getByRole('navigation', { name: /Mobile navigation/i });

    expect(within(mobileNav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Markets' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Build' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Portfolio' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Demo' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('provides a reusable route loading state', () => {
    render(<RouteLoadingState />);

    expect(screen.getByRole('status', { name: /Route loading state/i })).toBeInTheDocument();
  });

  it('renders a safe route recovery state when a route surface fails', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRecover = vi.fn();

    render(
      <RouteErrorBoundary
        onRecover={onRecover}
        resetKey="/markets"
        routeTitle="Market Intelligence"
      >
        <BrokenRouteSurface />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert', { name: /Route error state/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Could not load Market Intelligence' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(onRecover).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it('provides DApp Kit hooks to child components on Testnet', async () => {
    render(
      <AppProviders>
        <DAppKitHookSmoke />
      </AppProviders>,
    );

    expect(await screen.findByTestId('dapp-kit-network')).toHaveTextContent('testnet');
    expect(screen.getByTestId('dapp-kit-account')).toHaveTextContent('no-account');
    expect(screen.getByTestId('dapp-kit-client')).toHaveTextContent('client');
    expect(screen.getByTestId('dapp-kit-instance')).toHaveTextContent('dapp-kit');
    expect(screen.getByTestId('dapp-kit-wallet-status')).toHaveTextContent('disconnected');
  });
});
