import type { AppRoute, AppRouteId } from '@/app/routes';

interface MobileNavProps {
  activeRoute: AppRoute;
  onNavigate: (path: string) => void;
  routes: readonly AppRoute[];
}

const mobileRouteIds: AppRouteId[] = ['dashboard', 'markets', 'strategy', 'portfolio', 'demo'];

export function MobileNav({ activeRoute, onNavigate, routes }: MobileNavProps) {
  const mobileRoutes = routes.filter((route) => mobileRouteIds.includes(route.id));

  return (
    <nav
      aria-label="Mobile navigation"
      className="sticky bottom-0 grid grid-cols-5 border-t border-[#c8d3ce] bg-white lg:hidden"
    >
      {mobileRoutes.map((route) => {
        const active = activeRoute.id === route.id || (activeRoute.id === 'market-detail' && route.id === 'strategy');

        return (
          <a
            aria-current={active ? 'page' : undefined}
            className={`px-2 py-3 text-center text-xs font-semibold ${
              active ? 'bg-[#edf5f1] text-[#17211d]' : 'text-[#52615c]'
            }`}
            href={route.href}
            key={route.id}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(route.href);
            }}
          >
            {route.shortLabel}
          </a>
        );
      })}
    </nav>
  );
}
