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
    await expect(page.getByRole('button', { name: 'Enquadrar mapa' })).toBeVisible();

    await page.getByRole('button', { name: /Central da demo/i }).click();
    const demoPanel = page.getByRole('complementary', { name: /Central da Demo/i });
    await expect(demoPanel.getByRole('heading', { name: 'Central da Demo' })).toBeVisible();
    await expect(demoPanel.getByText(/tick \d+/)).toBeVisible();
    await expect(demoPanel.getByText('Ao vivo')).toBeVisible();

    await demoPanel.getByRole('button', { name: 'Resetar demo' }).click();
    await expect(page.getByRole('dialog', { name: /Resetar demo/i })).toBeVisible();
    await expect(page.getByText(/Novo plano de eventos será sorteado/i)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar reset' }).click();
    await expect(page.getByText('Reiniciando demo…')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel('Carregando operação POA Centro')).toBeHidden({ timeout: 30_000 });
    await expect(demoPanel.getByText('tick 0')).toBeVisible({ timeout: 15_000 });

    await demoPanel.getByRole('tab', { name: 'Cenários' }).click();
    await expect(demoPanel.getByText('Modo atual · Operação ao vivo')).toBeVisible();
    await expect(demoPanel.getByText('Surpresa de rede')).toBeVisible();

    const exploreCard = demoPanel.locator('.demo-center__scenario-card', { hasText: 'Enquadrar mapa' });
    await exploreCard.getByRole('button', { name: 'Executar' }).click();
    await expect(demoPanel).toBeVisible();
    await expect(demoPanel.getByText(/Mapa enquadrado/i)).toBeVisible({ timeout: 10_000 });

    const surpriseCard = demoPanel.locator('.demo-center__scenario-card', { hasText: 'Surpresa de rede' });
    await surpriseCard.getByRole('button', { name: 'Executar' }).click();
    await expect(page.getByRole('dialog', { name: /Aplicar cenário/i })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(demoPanel).toBeVisible();
    await expect(demoPanel.getByText(/evento/i)).toBeVisible({ timeout: 10_000 });

    await demoPanel.getByRole('tab', { name: 'Controle' }).click();
    await expect(demoPanel.getByText(/Selecione um entregador/i)).toBeVisible();

    const triggerRes = await request.post('http://localhost:8080/api/demo/trigger', {
      data: { courier_id: 'POA-07', action: 'go_stale' },
    });
    if (triggerRes.ok()) {
      await page.locator('.delivery-item').filter({ hasText: 'POA-07' }).first().click();
      await expect(page.getByRole('heading', { level: 2, name: 'POA-07' })).toBeVisible();
      await expect(demoPanel.getByRole('button', { name: 'Forçar sinal atrasado' })).toBeDisabled();

      const reconnectRes = await request.post('http://localhost:8080/api/demo/trigger', {
        data: { courier_id: 'POA-07', action: 'reconnect' },
      });
      expect(reconnectRes.ok()).toBeTruthy();
    }
  });
});
