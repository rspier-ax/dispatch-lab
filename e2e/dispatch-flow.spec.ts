import { test, expect } from '@playwright/test';

test.describe('DispatchLab operator flow', () => {
  test('loads POA map, opens demo center, selects POA-07, observes stale badge', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    await request.post('http://localhost:8080/api/demo/reset').catch(() => undefined);
    await page.goto('/');

    await expect(page.getByText('DispatchLab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('status', { name: /SSE conectado/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole('heading', { name: /Entregas ativas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Central da demo/i })).toBeVisible();
    await expect(page.getByText('Painel da demo')).toHaveCount(0);

    await page.getByRole('button', { name: /Central da demo/i }).click();
    await expect(page.getByRole('heading', { name: 'Central da Demo' })).toBeVisible();
    await expect(page.getByText('POA-07 — sinal atrasado')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('heading', { name: 'Central da Demo' })).toBeHidden();

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
