import { lazy, Suspense, useEffect } from 'react';
import { TestnetBanner } from '@/components/banners/TestnetBanner';
import { MobileNav } from '@/components/layout/MobileNav';
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
import { RouteErrorState, RouteLoadingState } from '@/components/layout/RouteStates';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';
import {
  loadDashboardPage,
  loadDemoModePage,
  loadHistoryPage,
  loadMarketDetailPage,
  loadMarketIntelligencePage,
  loadOracleStatusPage,
  loadPnlPage,
  loadPortfolioPage,
  loadPredictManagerPage,
  loadSVISurfacePage,
  loadVaultPage,
  preloadAppRoute,
  preloadOverviewRoutes,
} from '@/app/route-preload';
import type { AppRoute } from '@/app/routes';
import type { ObjectId } from '@/types/predict';

const DashboardPage = lazy(async () => ({
  default: (await loadDashboardPage()).DashboardPage,
}));
const DemoModePage = lazy(async () => ({
  default: (await loadDemoModePage()).DemoModePage,
}));
const HistoryPage = lazy(async () => ({
  default: (await loadHistoryPage()).HistoryPage,
}));
const MarketIntelligencePage = lazy(async () => ({
  default: (await loadMarketIntelligencePage()).MarketIntelligencePage,
}));
const PredictManagerPage = lazy(async () => ({
  default: (await loadPredictManagerPage()).PredictManagerPage,
}));
const OracleStatusPage = lazy(async () => ({
  default: (await loadOracleStatusPage()).OracleStatusPage,
}));
const SVISurfacePage = lazy(async () => ({
  default: (await loadSVISurfacePage()).SVISurfacePage,
}));
const PnlPage = lazy(async () => ({
  default: (await loadPnlPage()).PnlPage,
}));
const PortfolioPage = lazy(async () => ({
  default: (await loadPortfolioPage()).PortfolioPage,
}));
const MarketDetailPage = lazy(async () => ({
  default: (await loadMarketDetailPage()).MarketDetailPage,
}));
const VaultPage = lazy(async () => ({
  default: (await loadVaultPage()).VaultPage,
}));

interface AppShellProps {
  activeRoute: AppRoute;
  isNotFound: boolean;
  onNavigate: (path: string) => void;
  routes: readonly AppRoute[];
}

export function AppShell({ activeRoute, isNotFound, onNavigate, routes }: AppShellProps) {
  useEffect(() => {
    return scheduleOverviewPreload();
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#17211d]">
      <a
        className="absolute left-4 top-4 z-[60] -translate-y-24 border border-[#17211d] bg-white px-4 py-2 text-sm font-semibold text-[#17211d] transition focus:translate-y-0"
        href="#route-content"
      >
        Skip to route content
      </a>
      <TopBar activeRoute={activeRoute} />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:px-6">
        <SidebarNav
          activeRoute={activeRoute}
          onNavigate={onNavigate}
          onPreload={(routeId) => {
            void preloadAppRoute(routeId);
          }}
          routes={routes}
        />
        <main aria-label="Route content" className="min-w-0" id="route-content" tabIndex={-1}>
          <TestnetBanner />
          <section className="mt-4">
            {isNotFound ? (
              <RouteErrorState
                message="This route is not part of the approved PredictPilot terminal yet."
                onNavigate={() => onNavigate('/dashboard')}
                title="Route not found"
              />
            ) : (
              <RouteErrorBoundary
                onRecover={() => onNavigate('/dashboard')}
                resetKey={activeRoute.href}
                routeTitle={activeRoute.title}
              >
                <Suspense fallback={<RouteLoadingState title={`Loading ${activeRoute.title}`} />}>
                  <RouteContent onNavigate={onNavigate} route={activeRoute} />
                </Suspense>
              </RouteErrorBoundary>
            )}
          </section>
        </main>
      </div>
      <MobileNav activeRoute={activeRoute} onNavigate={onNavigate} routes={routes} />
    </div>
  );
}

function scheduleOverviewPreload() {
  const preload = () => {
    void preloadOverviewRoutes();
  };
  const idleScheduler = globalThis.requestIdleCallback;

  if (typeof idleScheduler === 'function') {
    const idleCallbackId = idleScheduler(preload, { timeout: 1_500 });

    return () => globalThis.cancelIdleCallback(idleCallbackId);
  }

  const timeoutId = globalThis.setTimeout(preload, 250);

  return () => globalThis.clearTimeout(timeoutId);
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
      return <SVISurfacePage oracleId={getOracleIdFromQuery(route.href)} />;
    case 'oracle-status':
      return <OracleStatusPage oracleId={getOracleIdFromQuery(route.href)} />;
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
      return <PredictManagerPage />;
    case 'not-found':
      return <RoutePlaceholder route={route} />;
  }
}

function getOracleIdFromMarketRoute(pathname: string) {
  const prefix = '/markets/';

  const pathOnly = pathname.split('?')[0] ?? pathname;

  return pathOnly.startsWith(prefix) ? decodeURIComponent(pathOnly.slice(prefix.length)) : null;
}

function getOracleIdFromQuery(pathname: string): ObjectId | undefined {
  const search = pathname.split('?')[1];

  if (search === undefined) {
    return undefined;
  }

  const oracleId = new URLSearchParams(search).get('oracleId');

  return oracleId === null ? undefined : (oracleId as ObjectId);
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
