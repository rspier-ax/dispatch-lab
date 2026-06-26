export const LOADING_LABELS = {
  pending: {
    applyingScenario: 'Aplicando cenário…',
    resettingDemo: 'Reiniciando demo…',
    forcingStale: 'Forçando sinal atrasado…',
    reconnecting: 'Reconectando…',
  },
  success: {
    scenarioApplied: 'Cenário aplicado.',
    demoReset: 'Demo reiniciada.',
    staleForced: 'Sinal atrasado simulado.',
    reconnected: 'Entregador reconectado.',
  },
  error: {
    scenarioFailed: 'Não foi possível executar o cenário.',
    resetFailed: 'Não foi possível reiniciar a demo.',
    triggerFailed: 'Não foi possível executar a ação.',
  },
} as const;
