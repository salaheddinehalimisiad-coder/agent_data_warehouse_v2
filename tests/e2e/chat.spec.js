// Tests interactions chat Atlas
import { test, expect } from '@playwright/test';
import { mockBackend, gotoApp } from './_helpers.js';

test.describe('Chat Atlas', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
    await gotoApp(page);
    await page.getByLabel(/Ouvrir l'Assistant IA/).click();
    await page.waitForSelector('text=Atlas');
  });

  test('clicking suggestion fills the input', async ({ page }) => {
    const sugg = page.getByText(/net_amount/).first();
    await sugg.click();
    const input = page.getByPlaceholder(/Demande a Atlas/);
    await expect(input).toHaveValue(/net_amount/);
  });

  test('typing in input works', async ({ page }) => {
    const input = page.getByPlaceholder(/Demande a Atlas/);
    await input.fill('Hello Atlas');
    await expect(input).toHaveValue('Hello Atlas');
  });

  test('keyboard shortcut hints visible', async ({ page }) => {
    await expect(page.getByText(/pour envoyer/)).toBeVisible();
    await expect(page.getByText(/nouvelle ligne/)).toBeVisible();
  });

  test('does NOT show old INTELLIGENCE/AUDIT tabs', async ({ page }) => {
    await expect(page.getByText('INTELLIGENCE', { exact: true })).not.toBeVisible();
    await expect(page.getByText('PENTAHO XML')).not.toBeVisible();
  });

  test('does NOT show old SYSTEM SECURE footer', async ({ page }) => {
    await expect(page.getByText(/COPILOT ACTIVE/)).not.toBeVisible();
  });

  test('Esc key closes the panel', async ({ page }) => {
    await page.keyboard.press('Escape');
    // After Esc, panel should be gone
    await expect(page.getByText(/BLAZE GLM-5/)).not.toBeVisible();
  });

  test('maximize button toggles fullscreen', async ({ page }) => {
    const maxBtn = page.getByTitle(/Plein ecran/);
    await maxBtn.click();
    // Apres maximize, le titre devient "Reduire"
    await expect(page.getByTitle(/Reduire/)).toBeVisible();
  });
});
