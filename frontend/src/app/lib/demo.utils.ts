import { DemoInfo, DeliveryEventPayload, ScenarioPreview } from '../services/dispatch/types';
import { DemoActionPreview, ResetPreview } from './demo-action.types';
import { GUIDED_DEMO_SCENARIOS } from './demo.constants';

export type DemoPanelTab = 'control' | 'scenarios' | 'events';

export function demoScenarios(info: DemoInfo | null) {
  return info?.scenarios?.length ? info.scenarios : GUIDED_DEMO_SCENARIOS;
}

export function demoNextScriptLabel(info: DemoInfo | null, tick: number): string {
  if (!info?.scripts.length) return 'Nenhum script agendado';
  const next = info.scripts.find((s) => s.tick > tick);
  if (!next) return 'Todos os scripts executados';
  const secs = Math.max(0, next.tick - tick) * (info.interval_ms / 1000);
  const action = next.action === 'go_stale' ? 'sinal atrasado' : 'reconexão';
  return `${next.courier_id} · ${action} no tick ${next.tick} (~${Math.round(secs)}s)`;
}

export function demoProgressPercent(tick: number, target = 90): number {
  return Math.min(100, Math.round((tick / target) * 100));
}

export function demoSimulationTimeLabel(tick: number, intervalMs = 1000): string {
  const base = new Date();
  base.setHours(14, 30, 0, 0);
  const t = new Date(base.getTime() + tick * intervalMs);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} · Ao vivo`;
}

export function filterDemoEvents(
  events: DeliveryEventPayload[],
  courierFilter: string | null,
): DeliveryEventPayload[] {
  const list = [...events].reverse();
  if (!courierFilter) return list;
  return list.filter((ev) => ev.courier_id === courierFilter);
}

export function eventTypeBadge(type: string): { label: string; tone: 'live' | 'stale' | 'neutral' | 'accent' } {
  if (type.includes('stale') || type === 'went_stale') return { label: 'Sinal', tone: 'stale' };
  if (type.includes('reconnect') || type === 'reconnected') return { label: 'Rede', tone: 'live' };
  if (type.includes('eta')) return { label: 'ETA', tone: 'accent' };
  if (type.includes('approach') || type.includes('pickup') || type.includes('transit')) {
    return { label: 'Rota', tone: 'accent' };
  }
  return { label: 'Evento', tone: 'neutral' };
}

export function groupEventsByRecency(events: DeliveryEventPayload[]): {
  label: string;
  items: DeliveryEventPayload[];
}[] {
  if (events.length < 10) {
    return [{ label: 'Recentes', items: events }];
  }
  const recent = events.slice(0, 5);
  const older = events.slice(5);
  return [
    { label: 'Últimos eventos', items: recent },
    { label: 'Anteriores', items: older },
  ];
}

export function toActionPreviewFromScenario(
  preview: ScenarioPreview,
  scenarioTitle: string,
): DemoActionPreview {
  return {
    kind: 'apply_scenario',
    title: 'Aplicar cenário',
    subtitle: scenarioTitle,
    can_apply: preview.can_apply,
    block_reason: preview.block_reason,
    severity: 'normal',
    summary_lines: preview.summary_lines,
    requires_reset: preview.requires_reset,
    confirm_label: 'Confirmar',
    applying_label: 'Aplicando…',
  };
}

export function toActionPreviewFromReset(preview: ResetPreview): DemoActionPreview {
  return {
    kind: 'reset',
    title: 'Resetar demo',
    can_apply: preview.can_apply,
    block_reason: preview.block_reason,
    severity: 'destructive',
    summary_lines: preview.summary_lines,
    requires_reset: false,
    confirm_label: 'Confirmar reset',
    applying_label: 'Reiniciando demo…',
  };
}
