import type { AppRoute, AppRouteId } from '@/app/routes';

interface SidebarNavProps {
  activeRoute: AppRoute;
  onNavigate: (path: string) => void;
  onPreload?: (routeId: AppRouteId) => void;
  routes: readonly AppRoute[];
}

const sections: AppRoute['section'][] = ['Overview', 'Execute', 'Assets', 'Demo'];
const sectionLabels: Record<AppRoute['section'], string> = {
  Assets: 'Assets',
  Demo: 'Demo',
  Execute: 'Execute',
  Overview: 'Overview',
};

export function SidebarNav({ activeRoute, onNavigate, onPreload, routes }: SidebarNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="hidden border border-[#c8d3ce] bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:flex-col"
    >
      <div className="border-b border-[#d9dfdc] pb-3">
        <p className="text-sm font-semibold text-[#17211d]">Navigation</p>
        <p className="mt-1 text-xs text-[#64736e]">DeepBook Predict workspace</p>
      </div>
      <div className="mt-3 flex-1 space-y-4">
        {sections.map((section) => (
          <section aria-label={section} key={section}>
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
              {sectionLabels[section]}
            </p>
            <div className="mt-2 space-y-1">
              {routes
                .filter((route) => route.section === section)
                .map((route) => (
                  <NavLink
                    active={isActiveRoute(activeRoute, route)}
                    key={route.id}
                    onNavigate={onNavigate}
                    onPreload={onPreload}
                    route={route}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  active,
  onNavigate,
  onPreload,
  route,
}: {
  active: boolean;
  onNavigate: (path: string) => void;
  onPreload?: (routeId: AppRouteId) => void;
  route: AppRoute;
}) {
  function preloadRoute() {
    onPreload?.(route.id);
  }

  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={`block border px-3 py-2 text-sm font-medium ${
        active
          ? 'border-[#719485] bg-[#edf5f1] text-[#17211d]'
          : 'border-transparent text-[#445750] hover:border-[#d9dfdc] hover:bg-[#f8fbfa]'
      }`}
      href={route.href}
      onFocus={preloadRoute}
      onMouseEnter={preloadRoute}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(route.href);
      }}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{route.label}</span>
        {active ? (
          <span className="text-xs uppercase tracking-[0.1em] text-[#446b5e]">Active</span>
        ) : null}
      </span>
    </a>
  );
}

function isActiveRoute(activeRoute: AppRoute, route: AppRoute) {
  if (activeRoute.id === route.id) {
    return true;
  }

  return activeRoute.id === 'market-detail' && route.id === 'strategy';
}
