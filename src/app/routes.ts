export type AppRouteId =
  | 'dashboard'
  | 'demo'
  | 'history'
  | 'manager'
  | 'market-detail'
  | 'markets'
  | 'not-found'
  | 'oracle-status'
  | 'pnl'
  | 'portfolio'
  | 'strategy'
  | 'svi'
  | 'vault';

export interface AppRoute {
  description: string;
  focus: string;
  href: string;
  id: AppRouteId;
  label: string;
  railDescription: string;
  railTitle: string;
  section: 'Assets' | 'Demo' | 'Execute' | 'Overview';
  shortLabel: string;
  title: string;
}

export const appRoutes = [
  {
    description: 'Terminal overview placeholder for live market, manager, and vault context.',
    focus: 'Market, manager, and vault readiness',
    href: '/dashboard',
    id: 'dashboard',
    label: 'Dashboard',
    railDescription: 'Future dashboard actions will route judges into the best next safe workflow.',
    railTitle: 'Readiness actions',
    section: 'Overview',
    shortLabel: 'Home',
    title: 'Dashboard',
  },
  {
    description: 'Market intelligence placeholder for oracle discovery and expiry scanning.',
    focus: 'Oracle discovery and market scanning',
    href: '/markets',
    id: 'markets',
    label: 'Markets',
    railDescription: 'Future market actions will select an oracle before trade preview.',
    railTitle: 'Market actions',
    section: 'Overview',
    shortLabel: 'Markets',
    title: 'Markets',
  },
  {
    description: 'SVI surface placeholder for volatility surface context and oracle pricing shape.',
    focus: 'SVI parameters, surface context, and market structure',
    href: '/svi',
    id: 'svi',
    label: 'SVI Surface',
    railDescription: 'Future SVI actions will compare surface changes before strategy staging.',
    railTitle: 'SVI context',
    section: 'Overview',
    shortLabel: 'SVI',
    title: 'SVI Surface',
  },
  {
    description: 'Oracle status placeholder for lifecycle, freshness, and settlement readiness.',
    focus: 'Oracle lifecycle, freshness, and settlement state',
    href: '/oracle-status',
    id: 'oracle-status',
    label: 'Oracle Status',
    railDescription: 'Future oracle actions will pin a focused market and show freshness checks.',
    railTitle: 'Oracle status',
    section: 'Overview',
    shortLabel: 'Oracle',
    title: 'Oracle Status',
  },
  {
    description: 'Focused market and strategy placeholder for binary and range preparation.',
    focus: 'Binary and range strategy preparation',
    href: '/strategy',
    id: 'strategy',
    label: 'Market Detail / Strategy',
    railDescription: 'Future strategy actions will stage strikes, quantity, risk, and simulation.',
    railTitle: 'Strategy builder',
    section: 'Execute',
    shortLabel: 'Build',
    title: 'Market Detail / Strategy',
  },
  {
    description: 'PredictManager placeholder for manager readiness and quote balances.',
    focus: 'Manager readiness and quote balance actions',
    href: '/manager',
    id: 'manager',
    label: 'PredictManager',
    railDescription: 'Future manager actions will create, deposit, and withdraw through PTBs.',
    railTitle: 'Manager actions',
    section: 'Execute',
    shortLabel: 'Manager',
    title: 'PredictManager',
  },
  {
    description: 'Portfolio placeholder for manager-backed positions and PnL context.',
    focus: 'Manager-backed positions and PnL',
    href: '/portfolio',
    id: 'portfolio',
    label: 'Portfolio',
    railDescription: 'Future portfolio actions will route open positions into preview flows.',
    railTitle: 'Position actions',
    section: 'Assets',
    shortLabel: 'Portfolio',
    title: 'Portfolio',
  },
  {
    description: 'PnL placeholder for manager profit, loss, and time-series performance context.',
    focus: 'Manager PnL, performance series, and realized activity',
    href: '/pnl',
    id: 'pnl',
    label: 'PnL',
    railDescription: 'Future PnL actions will connect position history to manager performance.',
    railTitle: 'PnL context',
    section: 'Assets',
    shortLabel: 'PnL',
    title: 'PnL',
  },
  {
    description: 'Vault and PLP placeholder for shared-liquidity supply and withdraw context.',
    focus: 'Vault liquidity, PLP, and exposure',
    href: '/vault',
    id: 'vault',
    label: 'Vault / PLP',
    railDescription: 'Future vault actions will stage PLP supply or withdrawal previews.',
    railTitle: 'Vault actions',
    section: 'Assets',
    shortLabel: 'Vault',
    title: 'Vault / PLP',
  },
  {
    description: 'History placeholder for server-backed mints, redeems, LP activity, and digests.',
    focus: 'Server-backed activity and digest proof',
    href: '/history',
    id: 'history',
    label: 'History',
    railDescription: 'Future history actions will inspect digest proof and refresh outcomes.',
    railTitle: 'Activity proof',
    section: 'Assets',
    shortLabel: 'History',
    title: 'History',
  },
  {
    description: 'Demo placeholder for judge walkthrough readiness and proof checkpoints.',
    focus: 'Judge walkthrough and proof checkpoints',
    href: '/demo',
    id: 'demo',
    label: 'Demo Mode',
    railDescription: 'Future demo actions will guide the approved live Testnet walkthrough.',
    railTitle: 'Demo flow',
    section: 'Demo',
    shortLabel: 'Demo',
    title: 'Demo Mode',
  },
] as const satisfies readonly AppRoute[];

type ListedAppRouteId = (typeof appRoutes)[number]['id'];

const notFoundRoute = {
  description: 'The requested route is not part of the PredictPilot shell yet.',
  focus: 'Safe fallback route',
  href: '/dashboard',
  id: 'not-found',
  label: 'Not Found',
  railDescription: 'No action is available for an unknown route.',
  railTitle: 'No route selected',
  section: 'Demo',
  shortLabel: 'Missing',
  title: 'Route Not Found',
} as const satisfies AppRoute;

export function resolveAppRoute(pathname: string): AppRoute {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === '/' || normalizedPath === '/dashboard') {
    return appRoutes[0];
  }

  if (normalizedPath.startsWith('/markets/')) {
    return {
      ...getAppRouteById('strategy'),
      href: normalizedPath,
      id: 'market-detail',
      title: 'Market Detail / Strategy',
    };
  }

  if (normalizedPath === '/oracle') {
    return getAppRouteById('oracle-status');
  }

  return appRoutes.find((route) => route.href === normalizedPath) ?? notFoundRoute;
}

function getAppRouteById(id: ListedAppRouteId): AppRoute {
  const route = appRoutes.find((item) => item.id === id);

  if (route === undefined) {
    throw new Error(`Missing PredictPilot route: ${id}`);
  }

  return route;
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}
