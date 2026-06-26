import {
  courierMetrics,
  deliveryMetaBadge,
  formatEta,
  formatEtaLabel,
  formatSignalAge,
  journeySteps,
  remainingDistanceM,
  staleAgeSeconds,
  trackingStateLabel,
  timelineDisplay,
} from './dispatch-view.utils';
import { Courier } from '../services/dispatch/types';

describe('dispatch-view.utils', () => {
  const courier: Courier = {
    id: 'POA-01',
    name: 'Ana',
    position: { lat: -30.0277, lng: -51.2284 },
    tracking_state: 'live',
    last_seen_at: new Date(Date.now() - 47_000).toISOString(),
    route: [
      { lat: -30.0277, lng: -51.2284 },
      { lat: -30.0295, lng: -51.2250 },
    ],
    route_index: 0,
    route_progress: 0.5,
    speed_mps: 8,
    delivery_id: 'DEL-001',
    eta_seconds: 180,
  };

  it('computes courier metrics', () => {
    const m = courierMetrics([
      courier,
      { ...courier, id: 'POA-02', tracking_state: 'stale' },
      { ...courier, id: 'POA-03', tracking_state: 'offline' },
    ]);
    expect(m.total).toBe(3);
    expect(m.live).toBe(1);
    expect(m.stale).toBe(1);
    expect(m.offline).toBe(1);
  });

  it('formats tracking labels in PT-BR', () => {
    expect(trackingStateLabel('stale')).toBe('Sinal atrasado');
    expect(trackingStateLabel('live')).toBe('Ao vivo');
  });

  it('computes stale age', () => {
    expect(staleAgeSeconds(courier.last_seen_at, Date.now())).toBeGreaterThanOrEqual(47);
    expect(formatSignalAge(47)).toBe('sinal há 47s');
  });

  it('formats eta', () => {
    expect(formatEta(180)).toBe('3 min');
    expect(formatEta(0)).toBe('—');
    expect(formatEtaLabel(0)).toBe('ETA indisponível');
    expect(formatEtaLabel(120)).toBe('ETA 2 min');
  });

  it('builds delivery meta badge for pills', () => {
    expect(deliveryMetaBadge({ status: 'in_transit', eta_seconds: 120 }, false)).toEqual({
      label: 'Em rota · ETA 2 min',
      tone: 'in-transit',
    });
    expect(deliveryMetaBadge({ status: 'in_transit', eta_seconds: 0 }, false)).toEqual({
      label: 'Em rota · ETA indisponível',
      tone: 'eta-unavailable',
    });
    expect(deliveryMetaBadge({ status: 'in_transit', eta_seconds: 120 }, true)).toEqual({
      label: 'Aguardando rota atual',
      tone: 'queued-wait',
    });
    expect(deliveryMetaBadge({ status: 'delivered', eta_seconds: 0 }, false)).toEqual({
      label: 'Entregue',
      tone: 'delivered',
    });
  });

  it('builds journey steps', () => {
    const base = { id: '1', courier_id: 'POA-01', timestamp: new Date().toISOString() };
    const steps = journeySteps('in_transit', [
      { ...base, type: 'started', message: 'start' },
      { ...base, type: 'picked_up', message: 'pickup' },
    ]);
    expect(steps.find((s) => s.id === 'pickup')?.state).toBe('done');
    expect(steps.find((s) => s.id === 'delivery')?.state).toBe('current');
  });

  it('maps delivered timeline display', () => {
    const d = timelineDisplay({
      id: '1',
      courier_id: 'POA-06',
      type: 'delivered',
      message: 'Entrega concluída — Usina do Gasômetro',
      timestamp: new Date().toISOString(),
    });
    expect(d.title).toBe('Entrega concluída');
  });

  it('computes remaining distance', () => {
    expect(remainingDistanceM(courier)).toBeGreaterThan(0);
  });

  it('maps timeline display for stale', () => {
    const d = timelineDisplay({
      id: '1',
      courier_id: 'POA-07',
      type: 'went_stale',
      message: 'test',
      timestamp: new Date().toISOString(),
    });
    expect(d.title).toContain('interrompido');
    expect(d.tone).toBe('stale');
  });
});
