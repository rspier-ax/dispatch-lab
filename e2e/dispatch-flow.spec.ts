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
    await expect(demoPanel.getByText('Ao vivo', { exact: true })).toBeVisible();

    await demoPanel.getByRole('button', { name: 'Resetar demo' }).click();
    await expect(page.getByRole('dialog', { name: /Resetar demo/i })).toBeVisible();
    await expect(page.getByText(/Novo plano de eventos será sorteado/i)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar reset' }).click();
    await expect(page.locator('.dispatch-boot__message')).toHaveText('Reiniciando demo…', {
      timeout: 5_000,
    });
    await expect(page.getByLabel('Carregando operação POA Centro')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByRole('status', { name: /SSE conectado/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: /Central da demo/i }).click();
    const demoPanelAfterReset = page.getByRole('complementary', { name: /Central da Demo/i });
    await expect(demoPanelAfterReset).toBeVisible({ timeout: 15_000 });
    await expect(demoPanelAfterReset.locator('.demo-center__tick')).toHaveText(/tick \d+/);

    const infoRes = await request.get('http://localhost:8080/api/demo/info');
    expect(infoRes.ok()).toBeTruthy();
    const info = (await infoRes.json()) as { tick: number };
    expect(info.tick).toBeLessThan(20);

    await demoPanelAfterReset.getByRole('tab', { name: 'Cenários' }).click();
    await expect(demoPanelAfterReset.getByText('Modo atual · Operação ao vivo')).toBeVisible();
    await expect(demoPanelAfterReset.getByText('Surpresa de rede')).toBeVisible();

    const exploreCard = demoPanelAfterReset.locator('.demo-center__scenario-card', {
      hasText: 'Enquadrar mapa',
    });
    await exploreCard.getByRole('button', { name: 'Executar' }).click();
    await expect(demoPanelAfterReset).toBeVisible();
    await expect(demoPanelAfterReset.getByText(/Mapa enquadrado/i)).toBeVisible({ timeout: 10_000 });

    const surpriseCard = demoPanelAfterReset.locator('.demo-center__scenario-card', {
      hasText: 'Surpresa de rede',
    });
    await surpriseCard.getByRole('button', { name: 'Executar' }).click();
    await expect(page.getByRole('dialog', { name: /Aplicar cenário/i })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(demoPanelAfterReset).toBeVisible();
    await expect(demoPanelAfterReset.getByText(/evento/i)).toBeVisible({ timeout: 10_000 });

    await demoPanelAfterReset.getByRole('tab', { name: 'Controle' }).click();
    await expect(demoPanelAfterReset.getByText(/Selecione um entregador/i)).toBeVisible();

    const triggerRes = await request.post('http://localhost:8080/api/demo/trigger', {
      data: { courier_id: 'POA-07', action: 'go_stale' },
    });
    if (triggerRes.ok()) {
      await page.locator('.delivery-item').filter({ hasText: 'POA-07' }).first().click();
      await expect(page.getByRole('heading', { level: 2, name: 'POA-07' })).toBeVisible();
      await expect(demoPanelAfterReset.getByRole('button', { name: 'Forçar sinal atrasado' })).toBeDisabled();

      const reconnectRes = await request.post('http://localhost:8080/api/demo/trigger', {
        data: { courier_id: 'POA-07', action: 'reconnect' },
      });
      expect(reconnectRes.ok()).toBeTruthy();
    }
  });
});
