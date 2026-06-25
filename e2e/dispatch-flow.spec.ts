import { test, expect } from '@playwright/test';

test.describe('DispatchLab operator flow', () => {
  test('loads POA map, selects POA-07, observes stale badge after scenario tick', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto('/');

    await expect(page.getByText('DispatchLab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('status', { name: /SSE conectado/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole('heading', { name: /Entregas ativas/i })).toBeVisible();
    const deliveryOption = page.getByRole('option', { name: /DEL-007/ });
    await expect(deliveryOption).toBeVisible();
    await deliveryOption.click();

    await expect(page.getByRole('heading', { level: 2, name: 'POA-07' })).toBeVisible();
    await expect(page.locator('.detail').getByText('Gabriela Lima', { exact: true })).toBeVisible();

    // Wait for tick 45 stale scenario (200ms ticks in E2E ≈ 9s)
    await expect(page.locator('.detail').getByRole('alert')).toContainText('Sinal atrasado', {
      timeout: 25_000,
    });

    // Wait for reconnect at tick 90 (≈ 18s total)
    await expect(page.locator('.detail .badge--live')).toBeVisible({ timeout: 25_000 });
  });
});
