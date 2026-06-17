import { TestnetBanner } from '@/components/banners/TestnetBanner';
import { ExecutionRail } from '@/components/layout/ExecutionRail';
import { MobileNav } from '@/components/layout/MobileNav';
import { RouteErrorState } from '@/components/layout/RouteStates';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DemoModePage } from '@/features/demo/DemoModePage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { MarketIntelligencePage } from '@/features/markets/MarketIntelligencePage';
import { OracleStatusPage } from '@/features/oracle/OracleStatusPage';
import { SVISurfacePage } from '@/features/oracle/SVISurfacePage';
import { PnlPage } from '@/features/portfolio/PnlPage';
import { PortfolioPage } from '@/features/portfolio/PortfolioPage';
import { MarketDetailPage } from '@/features/trade/MarketDetailPage';
import { VaultPage } from '@/features/vault/VaultPage';
import type { AppRoute } from '@/app/routes';

interface AppShellProps {
  activeRoute: AppRoute;
  isNotFound: boolean;
  onNavigate: (path: string) => void;
  routes: readonly AppRoute[];
}

export function AppShell({ activeRoute, isNotFound, onNavigate, routes }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#17211d]">
      <TopBar activeRoute={activeRoute} />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px] lg:px-6">
        <SidebarNav activeRoute={activeRoute} onNavigate={onNavigate} routes={routes} />
        <main className="min-w-0" id="route-content">
          <TestnetBanner />
          <section className="mt-4">
            {isNotFound ? (
              <RouteErrorState
                message="This placeholder route is not part of the approved PP-040 shell."
                onNavigate={() => onNavigate('/dashboard')}
                title="Route not found"
              />
            ) : (
              <RouteContent onNavigate={onNavigate} route={activeRoute} />
            )}
          </section>
        </main>
        <ExecutionRail activeRoute={activeRoute} />
      </div>
      <MobileNav activeRoute={activeRoute} onNavigate={onNavigate} routes={routes} />
    </div>
  );
}

function RouteContent({
  onNavigate,
  route,
}: {
  onNavigate: (path: string) => void;
  route: AppRoute;
}) {
  switch (route.id) {
    case 'dashboard':
      return <DashboardPage />;
    case 'markets':
      return <MarketIntelligencePage />;
    case 'svi':
      return <SVISurfacePage />;
    case 'oracle-status':
      return <OracleStatusPage />;
    case 'portfolio':
      return <PortfolioPage />;
    case 'pnl':
      return <PnlPage />;
    case 'history':
      return <HistoryPage />;
    case 'vault':
      return <VaultPage />;
    case 'market-detail':
      return <MarketDetailPage oracleId={getOracleIdFromMarketRoute(route.href)} />;
    case 'strategy':
      return <MarketDetailPage />;
    case 'demo':
      return <DemoModePage onNavigate={onNavigate} />;
    case 'manager':
    case 'not-found':
      return <RoutePlaceholder route={route} />;
  }
}

function getOracleIdFromMarketRoute(pathname: string) {
  const prefix = '/markets/';

  return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : null;
}

function RoutePlaceholder({ route }: { route: AppRoute }) {
  return (
    <article
      aria-labelledby="route-title"
      className="min-h-[420px] border border-[#c8d3ce] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-[#d9dfdc] pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
            {route.section}
          </p>
          <h1
            className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]"
            id="route-title"
          >
            {route.title}
          </h1>
        </div>
        <span className="w-fit border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
          Placeholder
        </span>
      </div>

      <div className="grid gap-4 py-5">
        <section aria-label={`${route.title} route placeholder`} className="space-y-4">
          <p className="max-w-3xl text-base leading-7 text-[#3f514b]">{route.description}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <ShellFact label="Status" value="Route ready" />
            <ShellFact label="Focus" value={route.focus} />
            <ShellFact label="Execution" value="Not wired" />
          </div>
        </section>
      </div>
    </article>
  );
}

function ShellFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-2 font-semibold text-[#17211d]">{value}</p>
    </div>
  );
}
