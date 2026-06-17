import { expect, test } from '@playwright/test';

const shellRoutes = [
  { heading: 'Dashboard', path: '/dashboard' },
  { heading: 'Market Intelligence', path: '/markets' },
  { heading: 'No oracle selected', path: '/svi' },
  { heading: 'No oracle selected', path: '/oracle-status' },
  { heading: 'Market Detail / Strategy', path: '/strategy' },
  { heading: 'Market Detail / Strategy', path: '/markets/0x123' },
  { heading: 'PredictManager', path: '/manager' },
  { heading: 'Portfolio', path: '/portfolio' },
  { heading: 'PnL', path: '/pnl' },
  { heading: 'Vault / PLP', path: '/vault' },
  { heading: 'History', path: '/history' },
  { heading: 'Demo Mode', path: '/demo' },
] as const;

test('loads the PredictPilot app shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: /Primary navigation/i })).toBeVisible();
  await expect(page.getByLabel('Terminal status strip')).toBeVisible();
  await expect(page.getByLabel('Persistent execution rail')).toBeVisible();
  await expect(page.getByText('Live terminal')).toBeVisible();
  await expect(page.getByText('Guarded wallet execution')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('status', { name: /Testnet status/i })).toBeVisible();
});

test('reaches mounted and placeholder routes from navigation', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByRole('link', { name: 'Vault / PLP' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vault / PLP' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vault actions' })).toBeVisible();

  await page.getByRole('link', { name: 'Demo Mode' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Demo Mode' })).toBeVisible();
});

test('demo mode is visibly offline and never claims execution proof', async ({ page }) => {
  await page.goto('/demo');

  await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
  await expect(page.getByRole('status', { name: /Testnet status/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Demo Mode' })).toBeVisible();
  await expect(page.getByText('Offline fixture').first()).toBeVisible();
  await expect(page.getByText('Not live Testnet proof').first()).toBeVisible();
  await expect(page.getByText('No wallet signature will be requested').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Oracle readiness' })).toBeVisible();

  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('heading', { name: 'Strategy preview' })).toBeVisible();

  await page.getByRole('button', { name: 'Step 5: Proof' }).click();
  await expect(page.getByRole('heading', { name: 'Proof boundary' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByRole('heading', { name: 'Oracle readiness' })).toBeVisible();
  await expect(page.getByRole('button', { name: /request wallet signature/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /view transaction/i })).toHaveCount(0);
});

test('every approved shell route loads inside the terminal shell', async ({ page }) => {
  for (const route of shellRoutes) {
    await page.goto(route.path);

    await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByLabel('Persistent execution rail')).toBeVisible();
  }
});

test('legacy oracle route resolves to the oracle status page empty state', async ({ page }) => {
  await page.goto('/oracle');

  await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'No oracle selected' })).toBeVisible();
  await expect(page.getByLabel('Persistent execution rail')).toBeVisible();
});

test('unknown routes render the safe route error state', async ({ page }) => {
  await page.goto('/not-a-real-route');

  await expect(page.getByRole('heading', { name: 'Route not found' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to dashboard' })).toBeVisible();
});

test('core mounted routes remain usable on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  for (const route of [
    { heading: 'Dashboard', path: '/dashboard' },
    { heading: 'Market Intelligence', path: '/markets' },
    { heading: 'Market Detail / Strategy', path: '/strategy' },
    { heading: 'Market Detail / Strategy', path: '/markets/0x123' },
    { heading: 'Portfolio', path: '/portfolio' },
    { heading: 'Vault / PLP', path: '/vault' },
  ]) {
    await page.goto(route.path);

    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /Mobile navigation/i })).toBeVisible();
    await expect(page.getByLabel('Terminal status strip')).toBeVisible();

    const hasHorizontalPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalPageOverflow).toBe(false);
  }
});
