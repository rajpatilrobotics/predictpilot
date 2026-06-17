import { expect, test } from '@playwright/test';

test.describe('execution flow safety smoke', () => {
  test('strategy and market detail routes never expose signing before review is ready', async ({
    page,
  }) => {
    await page.goto('/strategy');

    await expect(page.getByRole('heading', { level: 1, name: 'Market Detail / Strategy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Select a market first' })).toBeVisible();
    await expect(page.getByRole('button', { name: /request wallet signature/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /view transaction/i })).toHaveCount(0);

    await page.goto('/markets/0x123');

    await expect(page.getByRole('heading', { level: 1, name: 'Market Detail / Strategy' })).toBeVisible();
    await expect(page.getByLabel('Persistent execution rail')).toBeVisible();
    await expect(page.getByRole('button', { name: /request wallet signature/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /view transaction/i })).toHaveCount(0);
  });

  test('vault and history routes show honest walletless states without fake proof', async ({ page }) => {
    for (const route of ['/vault', '/portfolio', '/history']) {
      await page.goto(route);

      await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
      await expect(page.getByLabel('Terminal status strip')).toBeVisible();
      await expect(page.getByLabel('Persistent execution rail')).toBeVisible();
      await expect(page.getByRole('button', { name: /request wallet signature/i })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /view transaction/i })).toHaveCount(0);

      const hasVisiblePageText = await page.locator('main').evaluate((main) => {
        return main.textContent !== null && main.textContent.trim().length > 0;
      });
      expect(hasVisiblePageText).toBe(true);
    }
  });

  test('core flow routes remain nonblank on narrow mobile screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const route of ['/markets/0x123', '/strategy', '/vault', '/portfolio', '/history']) {
      await page.goto(route);

      await expect(page.getByRole('navigation', { name: /Mobile navigation/i })).toBeVisible();
      await expect(page.getByLabel('Terminal status strip')).toBeVisible();
      const hasHorizontalPageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalPageOverflow).toBe(false);
    }
  });
});
