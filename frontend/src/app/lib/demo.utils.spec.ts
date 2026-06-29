import {
  buildQueuedDeliveryRows,
  buildScheduleRows,
  demoElapsedLabel,
  demoScenarioLock,
  demoScenarioModeBanner,
  demoScenarios,
  demoSessionStatusLabel,
  filterDemoEvents,
  filterPlatformFeed,
  eventTypeBadge,
  groupEventsByRecency,
  groupPlatformFeedByRecency,
  isScenarioBlocked,
  platformFeedBadge,
  platformFeedTitle,
  toActionPreviewFromReset,
  toActionPreviewFromScenario,
} from './demo.utils';
import { FALLBACK_DEMO_INFO } from './demo.constants';
import { Courier, DeliveryEventPayload, PlatformFeedItem } from '../services/dispatch/types';

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

  it('detects active scenario lock from demo info', () => {
    const lock = demoScenarioLock(
      {
        ...FALLBACK_DEMO_INFO,
        scenario_lock: {
          active_id: 'network_surprise',
          until_tick: 80,
          remaining_events: 3,
        },
      },
      10,
    );
    expect(lock.locked).toBe(true);
    expect(lock.activeTitle).toBe('Surpresa de rede');
    expect(lock.remainingEvents).toBe(3);
  });

  it('releases scenario lock when tick passes until_tick', () => {
    const lock = demoScenarioLock(
      {
        ...FALLBACK_DEMO_INFO,
        scenario_lock: {
          active_id: 'network_surprise',
          until_tick: 80,
          remaining_events: 0,
        },
      },
      80,
    );
    expect(lock.locked).toBe(false);
  });

  it('blocks only scripted scenarios while lock is active', () => {
    const lock = demoScenarioLock(
      {
        ...FALLBACK_DEMO_INFO,
        scenario_lock: {
          active_id: 'network_surprise',
          until_tick: 80,
          remaining_events: 2,
        },
      },
      10,
    );
    expect(isScenarioBlocked('double_stale', lock)).toBe(true);
    expect(isScenarioBlocked('explore_routes', lock)).toBe(false);
  });

  it('builds locked mode banner copy', () => {
    const banner = demoScenarioModeBanner({
      locked: true,
      reason: '',
      remainingEvents: 2,
      activeTitle: 'Surpresa de rede',
      activeId: 'network_surprise',
    });
    expect(banner.heading).toContain('Surpresa de rede');
    expect(banner.detail).toContain('2 evento(s) restante(s)');
  });

  it('builds schedule rows with done, next and pending', () => {
    const rows = buildScheduleRows(
      [
        { courier_id: 'POA-01', tick: 5, action: 'go_stale' },
        { courier_id: 'POA-07', tick: 20, action: 'reconnect' },
        { courier_id: 'POA-03', tick: 25, action: 'go_stale' },
      ],
      10,
      1000,
    );
    expect(rows).toHaveSize(3);
    expect(rows[0].status).toBe('done');
    expect(rows[1].status).toBe('next');
    expect(rows[1].etaSeconds).toBe(10);
    expect(rows[2].status).toBe('pending');
  });

  it('uses live upcoming scripts in session status label', () => {
    const label = demoSessionStatusLabel(FALLBACK_DEMO_INFO, 10, [
      { courier_id: 'POA-99', tick: 15, action: 'go_stale' },
    ]);
    expect(label).toContain('POA-99');
    expect(label).toContain('~5s');
  });

  it('derives remaining lock events from upcoming scripts', () => {
    const lock = demoScenarioLock(
      {
        ...FALLBACK_DEMO_INFO,
        scenario_lock: {
          active_id: 'network_surprise',
          until_tick: 80,
          remaining_events: 99,
        },
      },
      10,
      [
        { courier_id: 'POA-01', tick: 20, action: 'go_stale' },
        { courier_id: 'POA-07', tick: 30, action: 'reconnect' },
      ],
    );
    expect(lock.remainingEvents).toBe(2);
  });

  it('builds queued delivery rows', () => {
    const couriers = [
      {
        id: 'POA-01',
        name: 'Ana',
        delivery_id: 'DEL-002',
      },
    ] as Courier[];
    const deliveries = [
      {
        id: 'DEL-001',
        courier_id: 'POA-01',
        courier_name: 'Ana',
        restaurant: 'Sushi',
        eta_seconds: 300,
      },
    ] as Parameters<typeof buildQueuedDeliveryRows>[0];
    const rows = buildQueuedDeliveryRows(deliveries, couriers);
    expect(rows).toHaveSize(1);
    expect(rows[0].deliveryId).toBe('DEL-001');
    expect(rows[0].restaurant).toBe('Sushi');
  });

  it('filters and groups platform feed', () => {
    const feed: PlatformFeedItem[] = [
      {
        kind: 'delivery_event',
        courier_id: 'POA-01',
        type: 'went_stale',
        message: 'Sinal atrasado',
        timestamp: '2026-01-01T10:00:00Z',
      },
      {
        kind: 'tracking_change',
        courier_id: 'POA-07',
        tracking_state: 'live',
        timestamp: '2026-01-01T10:01:00Z',
      },
    ];
    expect(filterPlatformFeed(feed, 'POA-07')).toHaveSize(1);
    expect(platformFeedBadge(feed[1]).tone).toBe('live');
    expect(platformFeedTitle(feed[1])).toBe('Sinal ao vivo');
    expect(groupPlatformFeedByRecency(feed)).toHaveSize(1);
  });
});
