// Tests E2E des exports
import { test, expect } from '@playwright/test';
import { mockBackend, gotoApp } from './_helpers.js';

test.describe('Export Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
    await gotoApp(page);
  });

  test.skip('can navigate to export panel', async ({ page }) => {
    // Suppose une nav vers Export
    // (Activer si la nav vers /export existe)
    await page.goto('/?view=export');
    await expect(page.getByText(/Exports & Livrables/)).toBeVisible();
  });
});

test.describe('Smoke - app loads', () => {
  test('app boots without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await mockBackend(page);
    await gotoApp(page);
    await page.waitForTimeout(1000);
    // Ignorer les erreurs reseau benignes
    const real = errors.filter(e => !/Failed to fetch|NetworkError|aborted/i.test(e));
    expect(real).toEqual([]);
  });
});
