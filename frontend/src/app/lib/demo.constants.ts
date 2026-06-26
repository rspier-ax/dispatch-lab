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

export const DEMO_CONTROLS_TOOLTIP =
  'Controles indisponíveis neste backend. Reinicie com DEMO_CONTROLS=true ou use ./scripts/dev.sh.';

/** Minimum full-screen loader duration after reset so the transition is readable. */
export const DEMO_RESET_MIN_MS = 1200;

export const GUIDED_DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'network_surprise',
    title: 'Surpresa de rede',
    description:
      'Agenda 2–4 eventos de sinal atrasado/reconexão em entregadores ao vivo. Use para criar tensão durante a apresentação.',
  },
  {
    id: 'double_stale',
    title: 'Dois entregadores',
    description:
      'Dois entregadores perdem sinal em sequência rápida — ideal para mostrar impacto na lista de entregas.',
  },
  {
    id: 'explore_routes',
    title: 'Enquadrar mapa',
    description:
      'Centraliza o mapa na área do Centro Histórico. Use no início da demo para contextualizar a operação.',
  },
  {
    id: 'tracking_states',
    title: 'Estados de tracking',
    description:
      'Foca um entregador com sinal atrasado (se houver) e abre a aba Controle para comparar badges e simulações manuais.',
  },
  {
    id: 'queue_focus',
    title: 'Fila na operação',
    description:
      'Filtra a lista de entregas para mostrar apenas itens na fila — entregas aguardando rota do entregador.',
  },
];

export const FALLBACK_DEMO_INFO: DemoInfo = {
  tick: 0,
  interval_ms: 1000,
  scripts: [
    { courier_id: 'POA-03', tick: 30, action: 'go_stale' },
    { courier_id: 'POA-03', tick: 60, action: 'reconnect' },
  ],
  scenarios: GUIDED_DEMO_SCENARIOS,
  controls_enabled: true,
  scenario_seed: 42,
};
