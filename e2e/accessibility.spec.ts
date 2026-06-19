import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const desktopRoutes = [
  '/dashboard',
  '/markets',
  '/manager',
  '/portfolio',
  '/vault',
  '/demo',
] as const;
const mobileRoutes = ['/dashboard', '/markets', '/manager', '/vault'] as const;

type AxeViolationSummary = {
  help: string;
  id: string;
  impact: 'critical' | 'serious';
  targets: string[];
};

function isBlockingImpact(impact: string | null | undefined): impact is 'critical' | 'serious' {
  return impact === 'critical' || impact === 'serious';
}

async function expectNoBlockingAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blockingViolations: AxeViolationSummary[] = results.violations
    .flatMap((violation): AxeViolationSummary[] => {
      if (!isBlockingImpact(violation.impact)) {
        return [];
      }

      return [
        {
          help: violation.help,
          id: violation.id,
          impact: violation.impact,
          targets: violation.nodes
            .flatMap((node) => node.target.map((selector) => String(selector)))
            .sort((left, right) => left.localeCompare(right)),
        },
      ];
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  expect(blockingViolations).toEqual([]);
}

test.describe('accessibility smoke', () => {
  for (const route of desktopRoutes) {
    test(`has no serious or critical axe violations on ${route}`, async ({ page }) => {
      await page.goto(route);

      await expect(page.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeVisible();
      await expect(page.getByRole('main', { name: 'Route content' })).toBeVisible();
      await expectNoBlockingAccessibilityViolations(page);
    });
  }

  for (const route of mobileRoutes) {
    test(`has no serious or critical mobile axe violations on ${route}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(route);

      await expect(page.getByRole('navigation', { name: /Mobile navigation/i })).toBeVisible();
      await expectNoBlockingAccessibilityViolations(page);
    });
  }

  test('keeps pre-sign strategy state accessible without fake execution proof', async ({
    page,
  }) => {
    await page.goto('/markets/0x123');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Market Detail / Strategy' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /request wallet signature/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /view transaction/i })).toHaveCount(0);
    await expectNoBlockingAccessibilityViolations(page);
  });
});
