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
  'dashboard|/dashboard|Overview|Dashboard|Home|Market, manager, and vault readiness|Terminal overview for live market, manager, vault, and proof-readiness context.|Readiness actions|Use this page to choose the safest next demo step: connect wallet, create manager, fund dUSDC, or inspect markets.',
  'markets|/markets|Overview|Markets|Markets|Oracle discovery and market scanning|Live market intelligence for oracle discovery, expiry scanning, freshness, and market selection.|Market actions|Select an active oracle, inspect freshness, then open its strategy builder for pre-sign review.',
  'svi|/svi|Overview|SVI Surface|SVI|SVI parameters, surface context, and market structure|SVI surface view for volatility context, latest price/SVI availability, and oracle pricing shape.|SVI context|Choose a focused oracle from Markets to inspect SVI data before staging a strategy.',
  'oracle-status|/oracle-status|Overview|Oracle Status|Oracle|Oracle lifecycle, freshness, and settlement state|Oracle status view for lifecycle, freshness, settlement, and action availability checks.|Oracle status|Choose a focused market to verify lifecycle and freshness before minting or redeeming.',
  'strategy|/strategy|Execute|Market Detail / Strategy|Build|Binary and range strategy preparation|Focused market and strategy builder for binary and range preparation with guarded pre-sign review.|Strategy builder|Stage strikes, quantity, and risk; valid flows open simulation before wallet signature.',
  'manager|/manager|Execute|PredictManager|Manager|Manager readiness and quote balance actions|PredictManager control center for discovery, creation, DUSDC deposit, and withdrawal review.|Manager actions|Create a manager or prepare DUSDC deposit/withdraw review after wallet and Testnet checks pass.',
  'portfolio|/portfolio|Assets|Portfolio|Portfolio|Manager-backed positions and PnL|Manager-backed portfolio view for balances, open positions, and readiness to redeem.|Position actions|Use open positions to decide whether to inspect markets, redeem, or refresh indexed manager state.',
  'pnl|/pnl|Assets|PnL|PnL|Manager PnL, performance series, and realized activity|Manager PnL view for performance, realized activity, and empty/error wallet states.|PnL context|Review manager performance after trades; final proof still comes from digest and refreshed history.',
  'vault|/vault|Assets|Vault / PLP|Vault|Vault liquidity, PLP, and exposure|Vault and PLP view for shared liquidity, exposure, supply review, and withdraw review.|Vault actions|Supply DUSDC or withdraw PLP through guarded simulation and wallet signature review.',
  'history|/history|Assets|History|History|Server-backed activity and digest proof|Server-backed activity timeline for mints, redeems, LP activity, and digest proof context.|Activity proof|Use history after execution to confirm indexed activity and capture final demo evidence.',
  'demo|/demo|Demo|Demo Mode|Demo|Judge walkthrough and proof checkpoints|Honest offline demo walkthrough for judges when wallet funding or live proof is unavailable.|Demo flow|Walk through the intended proof story without fake wallet signatures or fabricated digests.',
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
  const normalizedInput = normalizePathname(pathname);
  const [pathOnly, search = ''] = normalizedInput.split('?');
  const normalizedPath = normalizePathname(pathOnly ?? '/');
  const resolvedHref = search.length === 0 ? normalizedPath : `${normalizedPath}?${search}`;

  if (normalizedPath === '/' || normalizedPath === '/dashboard') {
    return appRoutes[0];
  }

  if (normalizedPath.startsWith('/markets/')) {
    return {
      ...getAppRouteById('strategy'),
      href: resolvedHref,
      id: 'market-detail',
      title: 'Market Detail / Strategy',
    };
  }

  if (normalizedPath === '/oracle') {
    return getAppRouteById('oracle-status');
  }

  const route = appRoutes.find((item) => item.href === normalizedPath);

  if (route === undefined) {
    return notFoundRoute;
  }

  return resolvedHref === route.href ? route : { ...route, href: resolvedHref };
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
