// Smoke test : landing page se charge et le bouton Atlas est visible
import { test, expect } from '@playwright/test';
import { mockBackend, gotoApp } from './_helpers.js';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test('Atlas floating button is visible', async ({ page }) => {
    await gotoApp(page);
    const fab = page.getByLabel(/Ouvrir l'Assistant IA/);
    await expect(fab).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Atlas button opens the chat panel', async ({ page }) => {
    await gotoApp(page);
    await page.getByLabel(/Ouvrir l'Assistant IA/).click();
    await expect(page.getByText('Atlas')).toBeVisible();
    await expect(page.getByText(/BLAZE GLM-5/)).toBeVisible();
  });

  test('chat panel closes with X button', async ({ page }) => {
    await gotoApp(page);
    await page.getByLabel(/Ouvrir l'Assistant IA/).click();
    await expect(page.getByText('Atlas')).toBeVisible();
    await page.getByTitle(/Fermer/).click();
    await expect(page.getByText(/BLAZE GLM-5/)).not.toBeVisible();
  });

  test('chat shows greeting and suggestions', async ({ page }) => {
    await gotoApp(page);
    await page.getByLabel(/Ouvrir l'Assistant IA/).click();
    await expect(page.getByText(/Bonjour, je suis Atlas/)).toBeVisible();
    await expect(page.getByText(/net_amount/)).toBeVisible();
  });
});
