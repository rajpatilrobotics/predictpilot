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

type ListedAppRouteId = Exclude<AppRouteId, 'market-detail' | 'not-found'>;

const routeSpecs = [
  'dashboard|/dashboard|Overview|Dashboard|Home|Market, manager, and vault readiness|Terminal overview placeholder for live market, manager, and vault context.|Readiness actions|Future dashboard actions will route judges into the best next safe workflow.',
  'markets|/markets|Overview|Markets|Markets|Oracle discovery and market scanning|Market intelligence placeholder for oracle discovery and expiry scanning.|Market actions|Future market actions will select an oracle before trade preview.',
  'svi|/svi|Overview|SVI Surface|SVI|SVI parameters, surface context, and market structure|SVI surface placeholder for volatility surface context and oracle pricing shape.|SVI context|Future SVI actions will compare surface changes before strategy staging.',
  'oracle-status|/oracle-status|Overview|Oracle Status|Oracle|Oracle lifecycle, freshness, and settlement state|Oracle status placeholder for lifecycle, freshness, and settlement readiness.|Oracle status|Future oracle actions will pin a focused market and show freshness checks.',
  'strategy|/strategy|Execute|Market Detail / Strategy|Build|Binary and range strategy preparation|Focused market and strategy placeholder for binary and range preparation.|Strategy builder|Future strategy actions will stage strikes, quantity, risk, and simulation.',
  'manager|/manager|Execute|PredictManager|Manager|Manager readiness and quote balance actions|PredictManager placeholder for manager readiness and quote balances.|Manager actions|Future manager actions will create, deposit, and withdraw through PTBs.',
  'portfolio|/portfolio|Assets|Portfolio|Portfolio|Manager-backed positions and PnL|Portfolio placeholder for manager-backed positions and PnL context.|Position actions|Future portfolio actions will route open positions into preview flows.',
  'pnl|/pnl|Assets|PnL|PnL|Manager PnL, performance series, and realized activity|PnL placeholder for manager profit, loss, and time-series performance context.|PnL context|Future PnL actions will connect position history to manager performance.',
  'vault|/vault|Assets|Vault / PLP|Vault|Vault liquidity, PLP, and exposure|Vault and PLP placeholder for shared-liquidity supply and withdraw context.|Vault actions|Future vault actions will stage PLP supply or withdrawal previews.',
  'history|/history|Assets|History|History|Server-backed activity and digest proof|History placeholder for server-backed mints, redeems, LP activity, and digests.|Activity proof|Future history actions will inspect digest proof and refresh outcomes.',
  'demo|/demo|Demo|Demo Mode|Demo|Judge walkthrough and proof checkpoints|Demo placeholder for judge walkthrough readiness and proof checkpoints.|Demo flow|Future demo actions will guide the approved live Testnet walkthrough.',
] as const;

export const appRoutes = routeSpecs.map(parseRouteSpec) as readonly AppRoute[];

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

function parseRouteSpec(spec: string): AppRoute {
  const [id, href, section, label, shortLabel, focus, description, railTitle, railDescription] =
    spec.split('|');

  if (
    !isListedRouteId(id) ||
    !isRouteSection(section) ||
    href === undefined ||
    label === undefined ||
    shortLabel === undefined ||
    focus === undefined ||
    description === undefined ||
    railTitle === undefined ||
    railDescription === undefined
  ) {
    throw new Error(`Invalid PredictPilot route spec: ${spec}`);
  }

  return {
    description,
    focus,
    href,
    id,
    label,
    railDescription,
    railTitle,
    section,
    shortLabel,
    title: label,
  };
}

function isListedRouteId(id: string | undefined): id is ListedAppRouteId {
  return (
    id === 'dashboard' ||
    id === 'demo' ||
    id === 'history' ||
    id === 'manager' ||
    id === 'markets' ||
    id === 'oracle-status' ||
    id === 'pnl' ||
    id === 'portfolio' ||
    id === 'strategy' ||
    id === 'svi' ||
    id === 'vault'
  );
}

function isRouteSection(section: string | undefined): section is AppRoute['section'] {
  return (
    section === 'Assets' || section === 'Demo' || section === 'Execute' || section === 'Overview'
  );
}

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
