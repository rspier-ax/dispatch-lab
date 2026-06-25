import { DemoInfo } from '../services/dispatch/types';
import { GUIDED_DEMO_SCENARIOS } from './demo.constants';

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
