import { test, expect } from '@playwright/test';

test.describe('DispatchLab operator flow', () => {
  test('loads POA map, selects POA-07, observes stale badge after scenario tick', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /DispatchLab — POA Centro/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('status', { name: /Conectado/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole('heading', { name: /Entregas ativas/i })).toBeVisible();
    const deliveryButton = page.getByRole('button').filter({ hasText: 'DEL-007' });
    await expect(deliveryButton).toBeVisible();
    await deliveryButton.click();

    await expect(page.getByRole('heading', { name: 'POA-07' })).toBeVisible();
    await expect(page.getByText('Gabriela Lima')).toBeVisible();

    // Wait for tick 45 stale scenario (200ms ticks in E2E ≈ 9s)
    await expect(page.getByText('Stale')).toBeVisible({ timeout: 25_000 });

    // Wait for reconnect at tick 90 (≈ 18s total)
    await expect(page.getByText('Ao vivo')).toBeVisible({ timeout: 25_000 });
  });
});
