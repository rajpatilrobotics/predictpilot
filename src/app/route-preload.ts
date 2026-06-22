import type { AppRouteId } from '@/app/routes';

type RouteModuleId = Exclude<AppRouteId, 'not-found'>;

const overviewRouteIds: AppRouteId[] = ['dashboard', 'markets', 'svi', 'oracle-status'];

const routeModuleCache = new Map<RouteModuleId, Promise<unknown>>();

export function loadDashboardPage() {
  return loadRouteModule('dashboard', () => import('@/features/dashboard/DashboardPage'));
}

export function loadDemoModePage() {
  return loadRouteModule('demo', () => import('@/features/demo/DemoModePage'));
}

export function loadHistoryPage() {
  return loadRouteModule('history', () => import('@/features/history/HistoryPage'));
}

export function loadMarketIntelligencePage() {
  return loadRouteModule('markets', () => import('@/features/markets/MarketIntelligencePage'));
}

export function loadPredictManagerPage() {
  return loadRouteModule('manager', () => import('@/features/manager/PredictManagerPage'));
}

export function loadOracleStatusPage() {
  return loadRouteModule('oracle-status', () => import('@/features/oracle/OracleStatusPage'));
}

export function loadSVISurfacePage() {
  return loadRouteModule('svi', () => import('@/features/oracle/SVISurfacePage'));
}

export function loadPnlPage() {
  return loadRouteModule('pnl', () => import('@/features/portfolio/PnlPage'));
}

export function loadProofModePage() {
  return loadRouteModule('proof', () => import('@/features/proof/ProofModePage'));
}

export function loadPortfolioPage() {
  return loadRouteModule('portfolio', () => import('@/features/portfolio/PortfolioPage'));
}

export function loadMarketDetailPage() {
  return loadRouteModule('strategy', () => import('@/features/trade/MarketDetailPage'));
}

export function loadVaultPage() {
  return loadRouteModule('vault', () => import('@/features/vault/VaultPage'));
}

export function preloadAppRoute(routeId: AppRouteId): Promise<void> {
  if (!isRouteModuleId(routeId)) {
    return Promise.resolve();
  }

  return loadRouteModuleById(routeId).then(
    () => undefined,
    () => undefined,
  );
}

export function preloadOverviewRoutes() {
  return Promise.all(overviewRouteIds.map((routeId) => preloadAppRoute(routeId))).then(
    () => undefined,
  );
}

function loadRouteModule<TModule>(routeId: RouteModuleId, loader: () => Promise<TModule>) {
  const cachedModule = routeModuleCache.get(routeId);

  if (cachedModule !== undefined) {
    return cachedModule as Promise<TModule>;
  }

  const modulePromise = loader().catch((error: unknown) => {
    routeModuleCache.delete(routeId);
    throw error;
  });

  routeModuleCache.set(routeId, modulePromise);
  return modulePromise;
}

function loadRouteModuleById(routeId: RouteModuleId) {
  switch (routeId) {
    case 'dashboard':
      return loadDashboardPage();
    case 'demo':
      return loadDemoModePage();
    case 'history':
      return loadHistoryPage();
    case 'manager':
      return loadPredictManagerPage();
    case 'market-detail':
    case 'strategy':
      return loadMarketDetailPage();
    case 'markets':
      return loadMarketIntelligencePage();
    case 'oracle-status':
      return loadOracleStatusPage();
    case 'pnl':
      return loadPnlPage();
    case 'portfolio':
      return loadPortfolioPage();
    case 'proof':
      return loadProofModePage();
    case 'svi':
      return loadSVISurfacePage();
    case 'vault':
      return loadVaultPage();
  }
}

function isRouteModuleId(routeId: AppRouteId): routeId is RouteModuleId {
  return routeId !== 'not-found';
}
