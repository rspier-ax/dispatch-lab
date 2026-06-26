import {
  demoElapsedLabel,
  demoScenarios,
  demoSessionStatusLabel,
  filterDemoEvents,
  eventTypeBadge,
  groupEventsByRecency,
  toActionPreviewFromReset,
  toActionPreviewFromScenario,
} from './demo.utils';
import { FALLBACK_DEMO_INFO } from './demo.constants';
import { DeliveryEventPayload } from '../services/dispatch/types';

describe('demo.utils', () => {
  it('falls back to guided scenarios when demo info is null', () => {
    expect(demoScenarios(null).length).toBe(5);
  });

  it('formats elapsed operation time from tick', () => {
    expect(demoElapsedLabel(0)).toBe('0s');
    expect(demoElapsedLabel(42)).toBe('42s');
    expect(demoElapsedLabel(102)).toBe('1m 42s');
  });

  it('describes next scheduled event in session status', () => {
    const label = demoSessionStatusLabel(FALLBACK_DEMO_INFO, 10);
    expect(label).toContain('POA-03');
    expect(label).toContain('~20s');
  });

  it('reports no upcoming events when scripts are exhausted', () => {
    expect(demoSessionStatusLabel(FALLBACK_DEMO_INFO, 95)).toBe(
      'Operação ao vivo · sem eventos agendados',
    );
  });

  it('reports empty session when no scripts', () => {
    expect(demoSessionStatusLabel({ ...FALLBACK_DEMO_INFO, scripts: [] }, 0)).toBe(
      'Operação ao vivo · sem eventos agendados',
    );
  });

  it('filters events by courier', () => {
    const events: DeliveryEventPayload[] = [
      { courier_id: 'POA-01', type: 'started', message: '', timestamp: '2026-01-01T10:00:00Z' },
      { courier_id: 'POA-07', type: 'went_stale', message: '', timestamp: '2026-01-01T10:01:00Z' },
    ];
    expect(filterDemoEvents(events, 'POA-07')).toHaveSize(1);
    expect(filterDemoEvents(events, null)).toHaveSize(2);
  });

  it('maps event types to badges', () => {
    expect(eventTypeBadge('went_stale').tone).toBe('stale');
    expect(eventTypeBadge('reconnected').tone).toBe('live');
  });

  it('groups long event lists', () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      courier_id: 'POA-01',
      type: 'started',
      message: '',
      timestamp: `2026-01-01T10:0${i % 10}:00Z`,
    }));
    expect(groupEventsByRecency(events)).toHaveSize(2);
  });

  it('maps scenario preview to action preview', () => {
    const action = toActionPreviewFromScenario(
      {
        can_apply: true,
        requires_reset: true,
        summary_lines: ['Agendará 2 eventos de rede.'],
      },
      'Surpresa de rede',
    );
    expect(action.kind).toBe('apply_scenario');
    expect(action.title).toBe('Aplicar cenário');
    expect(action.severity).toBe('normal');
    expect(action.requires_reset).toBe(true);
  });

  it('maps reset preview to destructive action preview', () => {
    const action = toActionPreviewFromReset({
      can_apply: true,
      requires_reset: false,
      summary_lines: ['Reinicia a operação do zero.'],
    });
    expect(action.kind).toBe('reset');
    expect(action.severity).toBe('destructive');
    expect(action.confirm_label).toBe('Confirmar reset');
  });
});
