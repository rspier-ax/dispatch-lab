import {
  demoNextScriptLabel,
  demoProgressPercent,
  demoScenarios,
  demoSimulationTimeLabel,
  filterDemoEvents,
  eventTypeBadge,
  groupEventsByRecency,
} from './demo.utils';
import { FALLBACK_DEMO_INFO } from './demo.constants';
import { DeliveryEventPayload } from '../services/dispatch/types';

describe('demo.utils', () => {
  it('falls back to guided scenarios when demo info is null', () => {
    expect(demoScenarios(null).length).toBe(4);
  });

  it('describes next scheduled script', () => {
    const label = demoNextScriptLabel(FALLBACK_DEMO_INFO, 10);
    expect(label).toContain('POA-07');
    expect(label).toContain('tick 45');
  });

  it('reports completed scripts after tick 90', () => {
    expect(demoNextScriptLabel(FALLBACK_DEMO_INFO, 95)).toBe('Todos os scripts executados');
  });

  it('computes progress toward tick 90', () => {
    expect(demoProgressPercent(45)).toBe(50);
    expect(demoProgressPercent(100)).toBe(100);
  });

  it('formats simulation clock from tick', () => {
    expect(demoSimulationTimeLabel(0)).toBe('14:30:00 · Ao vivo');
    expect(demoSimulationTimeLabel(60)).toBe('14:31:00 · Ao vivo');
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
});
