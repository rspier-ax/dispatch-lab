import { DemoInfo, DeliveryEventPayload, ScenarioPreview } from '../services/dispatch/types';
import { DemoActionPreview, ResetPreview } from './demo-action.types';
import { GUIDED_DEMO_SCENARIOS } from './demo.constants';

export type DemoPanelTab = 'control' | 'scenarios' | 'events';

export function demoScenarios(info: DemoInfo | null) {
  return info?.scenarios?.length ? info.scenarios : GUIDED_DEMO_SCENARIOS;
}

export function demoElapsedLabel(tick: number, intervalMs = 1000): string {
  const totalSec = Math.floor((tick * intervalMs) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function demoSessionStatusLabel(info: DemoInfo | null, tick: number): string {
  if (!info?.scripts?.length) {
    return 'Operação ao vivo · sem eventos agendados';
  }
  const upcoming = info.scripts.filter((s) => s.tick > tick);
  if (upcoming.length === 0) {
    return 'Operação ao vivo · sem eventos agendados';
  }
  const next = upcoming[0];
  const secs = Math.max(0, next.tick - tick) * (info.interval_ms / 1000);
  const action = next.action === 'go_stale' ? 'sinal atrasado' : 'reconexão';
  if (upcoming.length === 1) {
    return `Próximo evento · ${next.courier_id} · ${action} em ~${Math.round(secs)}s`;
  }
  return `Operação ao vivo · ${upcoming.length} eventos agendados · próximo: ${next.courier_id} em ~${Math.round(secs)}s`;
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
