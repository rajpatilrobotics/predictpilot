import { expect, test } from '@playwright/test';

test('loads the PredictPilot app shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
  await expect(page.getByText('Vite + React + TypeScript')).toBeVisible();
});
