import {
  Courier,
  Delivery,
  DemoInfo,
  DeliveryEventPayload,
  PlatformFeedItem,
  ScenarioPreview,
  ScriptAction,
} from '../services/dispatch/types';
import { DemoActionPreview, ResetPreview } from './demo-action.types';
import { GUIDED_DEMO_SCENARIOS } from './demo.constants';
import { isQueuedDelivery, timelineDisplay } from './dispatch-view.utils';

export type DemoPanelTab = 'control' | 'scenarios' | 'events';

export const SCRIPTED_SCENARIOS = new Set(['network_surprise', 'double_stale']);

export interface DemoScenarioLockState {
  locked: boolean;
  reason: string;
  remainingEvents: number;
  activeTitle: string;
  activeId: string;
}

export function scenarioTitleFromId(id: string, info: DemoInfo | null): string {
  const match = demoScenarios(info).find((s) => s.id === id);
  return match?.title ?? id;
}

export function demoScenarioLock(
  info: DemoInfo | null,
  tick: number,
  upcomingScripts?: ScriptAction[],
): DemoScenarioLockState {
  const idle: DemoScenarioLockState = {
    locked: false,
    reason: '',
    remainingEvents: 0,
    activeTitle: '',
    activeId: '',
  };
  const lock = info?.scenario_lock;
  if (!lock || lock.until_tick <= tick) {
    return idle;
  }
  const remaining =
    upcomingScripts !== undefined
      ? upcomingScripts.filter((s) => s.tick > tick).length
      : lock.remaining_events;
  const activeTitle = scenarioTitleFromId(lock.active_id, info);
  return {
    locked: true,
    reason: `Cenário anterior ainda em andamento (${remaining} evento(s) restante(s)). Aguarde ou resete a demo.`,
    remainingEvents: remaining,
    activeTitle,
    activeId: lock.active_id,
  };
}

export function isScenarioBlocked(scenarioId: string, lock: DemoScenarioLockState): boolean {
  return lock.locked && SCRIPTED_SCENARIOS.has(scenarioId);
}

export function demoScenarioModeBanner(lock: DemoScenarioLockState): {
  heading: string;
  detail: string | null;
} {
  if (!lock.locked) {
    return { heading: 'Modo atual · Operação ao vivo', detail: null };
  }
  return {
    heading: `Cenário ativo · ${lock.activeTitle}`,
    detail: `${lock.remainingEvents} evento(s) restante(s) — aguarde ou resete a demo`,
  };
}

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

export function demoSessionStatusLabel(
  info: DemoInfo | null,
  tick: number,
  upcomingScripts?: ScriptAction[],
): string {
  const intervalMs = info?.interval_ms ?? 1000;
  const upcoming =
    upcomingScripts !== undefined
      ? upcomingScripts.filter((s) => s.tick > tick)
      : (info?.scripts?.filter((s) => s.tick > tick) ?? []);

  if (upcoming.length === 0) {
    return 'Operação ao vivo · sem eventos agendados';
  }
  const next = upcoming[0];
  const secs = Math.max(0, next.tick - tick) * (intervalMs / 1000);
  const action = scriptActionLabel(next.action);
  if (upcoming.length === 1) {
    return `Próximo evento · ${next.courier_id} · ${action} em ~${Math.round(secs)}s`;
  }
  return `Operação ao vivo · ${upcoming.length} eventos agendados · próximo: ${next.courier_id} em ~${Math.round(secs)}s`;
}

export type ScheduleRowStatus = 'done' | 'next' | 'pending';

export interface ScheduleRow {
  courierId: string;
  tick: number;
  etaSeconds: number;
  actionLabel: string;
  status: ScheduleRowStatus;
}

export interface QueuedDeliveryRow {
  deliveryId: string;
  courierId: string;
  courierName: string;
  restaurant: string;
  etaSeconds: number;
}

export function scriptActionLabel(action: string): string {
  if (action === 'go_stale') return 'Sinal atrasado';
  if (action === 'reconnect') return 'Reconexão';
  return action;
}

export function buildScheduleRows(
  scripts: ScriptAction[],
  tick: number,
  intervalMs: number,
): ScheduleRow[] {
  if (!scripts.length) return [];
  const sorted = [...scripts].sort(
    (a, b) => a.tick - b.tick || a.courier_id.localeCompare(b.courier_id),
  );
  let nextAssigned = false;
  return sorted.map((s) => {
    let status: ScheduleRowStatus;
    if (s.tick <= tick) {
      status = 'done';
    } else if (!nextAssigned) {
      status = 'next';
      nextAssigned = true;
    } else {
      status = 'pending';
    }
    return {
      courierId: s.courier_id,
      tick: s.tick,
      etaSeconds: Math.max(0, ((s.tick - tick) * intervalMs) / 1000),
      actionLabel: scriptActionLabel(s.action),
      status,
    };
  });
}

export function buildQueuedDeliveryRows(
  deliveries: Delivery[],
  couriers: Courier[],
): QueuedDeliveryRow[] {
  return deliveries
    .filter((d) => isQueuedDelivery(d, couriers))
    .map((d) => ({
      deliveryId: d.id,
      courierId: d.courier_id,
      courierName: d.courier_name,
      restaurant: d.restaurant,
      etaSeconds: d.eta_seconds,
    }))
    .sort((a, b) => a.etaSeconds - b.etaSeconds);
}

export function scheduleStatusLabel(status: ScheduleRowStatus): string {
  if (status === 'done') return 'Concluído';
  if (status === 'next') return 'Próximo';
  return 'Aguardando';
}

export function partitionScheduleRows(rows: ScheduleRow[]): {
  upcoming: ScheduleRow[];
  done: ScheduleRow[];
} {
  return {
    upcoming: rows.filter((r) => r.status !== 'done'),
    done: rows.filter((r) => r.status === 'done'),
  };
}

export type PlatformFeedKindFilter = 'all' | 'signal' | 'network' | 'tracking' | 'route';

export function platformFeedKindLabel(item: PlatformFeedItem): string {
  if (item.kind === 'tracking_change') {
    if (item.tracking_state === 'live') return 'Tracking';
    if (item.tracking_state === 'stale') return 'Sinal';
    return 'Sem sinal';
  }
  const badge = eventTypeBadge(item.type);
  return badge.label;
}

export function platformFeedKindKey(item: PlatformFeedItem): PlatformFeedKindFilter {
  if (item.kind === 'tracking_change') return 'tracking';
  const type = item.type;
  if (type.includes('stale') || type === 'went_stale') return 'signal';
  if (type.includes('reconnect') || type === 'reconnected') return 'network';
  if (type.includes('approach') || type.includes('pickup') || type.includes('transit')) {
    return 'route';
  }
  return 'tracking';
}

export function filterPlatformFeedByKind(
  feed: PlatformFeedItem[],
  kind: PlatformFeedKindFilter,
): PlatformFeedItem[] {
  if (kind === 'all') return feed;
  return feed.filter((item) => platformFeedKindKey(item) === kind);
}

export function filterPlatformFeed(
  feed: PlatformFeedItem[],
  courierFilter: string | null,
  kindFilter: PlatformFeedKindFilter = 'all',
): PlatformFeedItem[] {
  let list = [...feed].reverse();
  if (courierFilter) {
    list = list.filter((item) => item.courier_id === courierFilter);
  }
  return filterPlatformFeedByKind(list, kindFilter);
}

export function platformFeedBadge(
  item: PlatformFeedItem,
): { label: string; tone: 'live' | 'stale' | 'neutral' | 'accent' } {
  if (item.kind === 'tracking_change') {
    if (item.tracking_state === 'live') return { label: 'Ao vivo', tone: 'live' };
    if (item.tracking_state === 'stale') return { label: 'Sinal', tone: 'stale' };
    return { label: 'Sem sinal', tone: 'neutral' };
  }
  return eventTypeBadge(item.type);
}

export function platformFeedTitle(item: PlatformFeedItem): string {
  if (item.kind === 'tracking_change') {
    const labels: Record<string, string> = {
      live: 'Sinal ao vivo',
      stale: 'Sinal atrasado',
      offline: 'Sem sinal',
    };
    return labels[item.tracking_state] ?? item.tracking_state;
  }
  return timelineDisplay({
    id: '',
    courier_id: item.courier_id,
    type: item.type,
    message: item.message,
    timestamp: item.timestamp,
  }).title;
}

export function platformFeedMessage(item: PlatformFeedItem): string | null {
  if (item.kind === 'delivery_event' && item.message) {
    return item.message;
  }
  return null;
}

export function platformFeedDeliveryId(item: PlatformFeedItem): string | null {
  if (item.kind === 'delivery_event' && item.delivery_id) {
    return item.delivery_id;
  }
  return null;
}

export function groupPlatformFeedByRecency(feed: PlatformFeedItem[]): {
  label: string;
  items: PlatformFeedItem[];
}[] {
  if (feed.length < 10) {
    return [{ label: 'Recentes', items: feed }];
  }
  const recent = feed.slice(0, 5);
  const older = feed.slice(5);
  return [
    { label: 'Últimos eventos', items: recent },
    { label: 'Anteriores', items: older },
  ];
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
