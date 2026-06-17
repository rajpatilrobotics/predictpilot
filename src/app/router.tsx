import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/app/AppShell';
import { appRoutes, resolveAppRoute } from '@/app/routes';

export function AppRouter() {
  const [pathname, setPathname] = useState(() => getCurrentPathname());
  const activeRoute = useMemo(() => resolveAppRoute(pathname), [pathname]);

  useEffect(() => {
    function handlePopState() {
      setPathname(getCurrentPathname());
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigateTo(path: string) {
    window.history.pushState({}, '', path);
    setPathname(getCurrentPathname());
  }

  return (
    <AppShell
      activeRoute={activeRoute}
      isNotFound={activeRoute.id === 'not-found'}
      onNavigate={navigateTo}
      routes={appRoutes}
    />
  );
}

function getCurrentPathname() {
  return window.location.pathname;
}
