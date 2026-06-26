import { DemoInfo, DemoScenario } from '../services/dispatch/types';

export interface DemoMapPrefs {
  showBoundsOverlay: boolean;
  showRoutePolyline: boolean;
  highlightCourierId: string | null;
}

export const DEFAULT_DEMO_MAP_PREFS: DemoMapPrefs = {
  showBoundsOverlay: false,
  showRoutePolyline: true,
  highlightCourierId: null,
};

export const COMING_SOON_TOOLTIP = 'Em breve — requer suporte no simulador.';
export const DEMO_CONTROLS_TOOLTIP =
  'Controles indisponíveis neste backend. Reinicie com DEMO_CONTROLS=true ou use ./scripts/dev.sh.';
export const SEEK_TOOLTIP = 'Seek em breve — avanço manual ainda não disponível.';

export const GUIDED_DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'poa07_stale',
    title: 'POA-07 — sinal atrasado',
    description:
      'Selecione DEL-007 e aguarde o tick 45 (~45s) para ver o entregador ficar com sinal atrasado na Rua dos Andradas.',
    courier_id: 'POA-07',
    delivery_id: 'DEL-007',
  },
  {
    id: 'random_stale',
    title: 'Sinal atrasado — entregador aleatório',
    description:
      'Escolhe um entregador ao vivo e agenda perda de sinal e reconexão nos próximos ticks.',
  },
  {
    id: 'explore_routes',
    title: 'Explorar rotas nas ruas',
    description:
      'Selecione qualquer entregador ao vivo e observe a rota restante seguindo o grid viário do Centro Histórico.',
  },
  {
    id: 'tracking_states',
    title: 'Estados de tracking',
    description: 'Compare badges Ao vivo, Sinal atrasado e Sem sinal na lista e no mapa.',
  },
];

export const FALLBACK_DEMO_INFO: DemoInfo = {
  tick: 0,
  interval_ms: 1000,
  scripts: [
    { courier_id: 'POA-07', tick: 45, action: 'go_stale' },
    { courier_id: 'POA-07', tick: 90, action: 'reconnect' },
  ],
  scenarios: GUIDED_DEMO_SCENARIOS,
  controls_enabled: true,
  scenario_seed: 42,
};
