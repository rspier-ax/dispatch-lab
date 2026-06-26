import { test, expect } from '@playwright/test';

test.describe('DispatchLab operator flow', () => {
  test('loads POA map, docked demo panel with tabs, map meta overlay', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    await request.post('http://localhost:8080/api/demo/reset').catch(() => undefined);
    await page.goto('/');

    await expect(page.getByLabel('Carregando operação POA Centro')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText('DispatchLab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('status', { name: /SSE conectado/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole('heading', { name: /^Entregas$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Ativas/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Concluídas/i })).toBeVisible();
    await expect(page.getByText('Atualizações em tempo real ativas')).toHaveCount(0);
    await expect(page.locator('app-dispatch-footer')).toHaveCount(0);
    await expect(page.getByText('Demo v1.0.0')).toBeVisible();
    await expect(page.getByText('Centro Histórico · POA Centro')).toBeVisible();

    await page.getByRole('button', { name: /Central da demo/i }).click();
    const demoPanel = page.getByRole('complementary', { name: /Central da Demo/i });
    await expect(demoPanel.getByRole('heading', { name: 'Central da Demo' })).toBeVisible();
    await expect(demoPanel.getByText(/Tick \d+/)).toBeVisible();
    await expect(demoPanel.getByText(/Ao vivo/)).toBeVisible();

    await expect(demoPanel.getByRole('tab', { name: 'Controle' })).toBeVisible();
    await demoPanel.getByRole('tab', { name: 'Cenários' }).click();
    await expect(demoPanel.getByText('POA-07 — sinal atrasado')).toBeVisible();
    await expect(demoPanel.getByRole('button', { name: 'Aplicar cenário' })).toBeDisabled();

    await demoPanel.getByRole('tab', { name: 'Eventos' }).click();
    await expect(demoPanel.getByText('Filtrar por entregador')).toBeVisible();

    await demoPanel.getByRole('tab', { name: 'Cenários' }).click();
    await demoPanel.getByText('Explorar rotas nas ruas').click();
    await expect(demoPanel.getByRole('button', { name: 'Aplicar cenário' })).toBeEnabled();
    await demoPanel.getByRole('button', { name: 'Aplicar cenário' }).click();
    await expect(page.getByRole('dialog', { name: /Aplicar cenário/i })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(demoPanel).toBeHidden();

    await page.getByRole('button', { name: /Central da demo/i }).click();
    await demoPanel.getByRole('tab', { name: 'Cenários' }).click();
    await demoPanel.getByText('POA-07 — sinal atrasado').click();
    await demoPanel.getByRole('button', { name: 'Aplicar cenário' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(demoPanel).toBeHidden();

    await expect(page.getByRole('heading', { level: 2, name: 'POA-07' })).toBeVisible();
    await expect(page.locator('.detail').getByText('Gabriela Lima', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Acompanhe o percurso: entregador → restaurante → cliente'),
    ).toBeVisible();
    await expect(page.locator('.journey-stepper__label', { hasText: 'Despacho' })).toBeVisible();
    await expect(page.getByText('ETA calculando')).toHaveCount(0);

    const triggerRes = await request.post('http://localhost:8080/api/demo/trigger', {
      data: { courier_id: 'POA-07', action: 'go_stale' },
    });
    if (triggerRes.ok()) {
      await expect(page.locator('.detail').getByRole('alert')).toContainText('Sinal atrasado', {
        timeout: 10_000,
      });

      const reconnectRes = await request.post('http://localhost:8080/api/demo/trigger', {
        data: { courier_id: 'POA-07', action: 'reconnect' },
      });
      expect(reconnectRes.ok()).toBeTruthy();
      await expect(page.locator('.detail .badge--live')).toBeVisible({ timeout: 10_000 });
    }
  });
});
