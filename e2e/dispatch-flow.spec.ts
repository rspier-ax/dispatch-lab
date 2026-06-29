import { test, expect, Page } from '@playwright/test';

async function openDemoPanel(page: Page) {
  const toggle = page.getByRole('button', { name: /Central da demo/i });
  const panel = page.getByRole('complementary', { name: /Central da Demo/i });
  const pressed = await toggle.getAttribute('aria-pressed');
  if (pressed !== 'true') {
    await toggle.click();
  }
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

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

    const demoPanel = await openDemoPanel(page);
    await expect(demoPanel.getByRole('heading', { name: 'Central da Demo' })).toBeVisible();
    await expect(demoPanel.locator('.demo-center__tick')).toHaveText(/tick \d+/);
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

    const demoPanelAfterReset = await openDemoPanel(page);
    await expect(demoPanelAfterReset.locator('.demo-center__tick')).toHaveText(/tick \d+/);

    const infoRes = await request.get('http://localhost:8080/api/demo/info');
    expect(infoRes.ok()).toBeTruthy();
    const info = (await infoRes.json()) as { tick: number };
    expect(info.tick).toBeLessThan(30);

    await demoPanelAfterReset.getByRole('tab', { name: 'Cenários' }).click();
    await expect(demoPanelAfterReset.getByText('Modo atual · Operação ao vivo')).toBeVisible();
    await expect(demoPanelAfterReset.getByText('Surpresa de rede')).toBeVisible();

    const exploreCard = demoPanelAfterReset.getByRole('article').filter({
      hasText: /Enquadrar mapa|Explorar rotas/,
    });
    await expect(exploreCard).toBeVisible();
    await exploreCard.getByRole('button', { name: 'Executar' }).click();
    await expect(demoPanelAfterReset).toBeVisible();
    await expect(page.locator('.snackbar').getByText(/Mapa enquadrado|visão do mapa/i)).toBeVisible({
      timeout: 10_000,
    });

    const surpriseCard = demoPanelAfterReset.getByRole('article').filter({
      hasText: 'Surpresa de rede',
    });
    await surpriseCard.getByRole('button', { name: 'Executar' }).click();
    await expect(page.getByRole('dialog', { name: /Aplicar cenário/i })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('dialog', { name: /Aplicar cenário/i })).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('.snackbar').getByText(/Agendará \d+ evento/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(demoPanelAfterReset.locator('.demo-center__mode-banner--locked')).toBeVisible({
      timeout: 10_000,
    });
    await expect(demoPanelAfterReset.getByText(/Cenário ativo · Surpresa de rede/i)).toBeVisible();

    await page.waitForTimeout(1300);

    const doubleStaleCard = demoPanelAfterReset.getByRole('article').filter({
      hasText: 'Dois entregadores',
    });
    await expect(doubleStaleCard.getByRole('button', { name: 'Executar' })).toBeDisabled();
    await expect(exploreCard.getByRole('button', { name: 'Executar' })).toBeEnabled();

    await demoPanelAfterReset.getByRole('tab', { name: 'Controle' }).click();
    await expect(demoPanelAfterReset.getByRole('heading', { name: 'Simulações rápidas' })).toBeVisible();
    await expect(
      demoPanelAfterReset.getByRole('button', { name: 'Forçar sinal atrasado' }),
    ).toBeDisabled();
    await expect(demoPanelAfterReset.getByRole('button', { name: 'Reconectar' })).toBeDisabled();

    await demoPanelAfterReset.getByRole('tab', { name: 'Eventos' }).click();
    await expect(demoPanelAfterReset.locator('.events-summary')).toBeVisible();
    await expect(demoPanelAfterReset.getByText('Próximo evento')).toBeVisible({ timeout: 10_000 });
    await expect(
      demoPanelAfterReset.getByRole('button', { name: 'Ver auditoria completa' }),
    ).toBeVisible();

    const panelBox = await demoPanelAfterReset.boundingBox();
    expect(panelBox?.width ?? 0).toBeLessThanOrEqual(500);

    await page.getByRole('button', { name: 'Eventos operacionais' }).click();
    const auditShell = page.locator('.audit-shell');
    await expect(auditShell).toBeVisible();
    await expect(auditShell.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(auditShell.locator('.audit-table__row--next')).toHaveCount(1, {
      timeout: 10_000,
    });

    const logBody = auditShell.locator('.audit-pane--log .audit-pane__body');
    await logBody.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(logBody.locator('.audit-table__row').first()).toBeVisible();
  });
});
