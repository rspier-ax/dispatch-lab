import { TestBed } from '@angular/core/testing';
import { DispatchStreamService } from './dispatch-stream.service';
import { Courier, Delivery } from './types';

describe('DispatchStreamService', () => {
  let service: DispatchStreamService;

  const sampleCouriers: Courier[] = [
    {
      id: 'POA-01',
      name: 'Ana',
      position: { lat: -30.0277, lng: -51.2284 },
      tracking_state: 'live',
      last_seen_at: new Date().toISOString(),
      route: [],
      route_index: 0,
      route_progress: 0,
      speed_mps: 8,
      delivery_id: 'DEL-001',
      eta_seconds: 120,
    },
  ];

  const sampleDeliveries: Delivery[] = [
    {
      id: 'DEL-001',
      courier_id: 'POA-01',
      courier_name: 'Ana',
      restaurant: 'Test',
      street: 'Rua X',
      pickup: { lat: 0, lng: 0 },
      dropoff: { lat: 0, lng: 0 },
      status: 'in_transit',
      customer_name: 'Cliente',
      eta_seconds: 120,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DispatchStreamService],
    });
    service = TestBed.inject(DispatchStreamService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('initializes stream state from snapshot', () => {
    service.connect(sampleCouriers, sampleDeliveries);
    let name = '';
    service.state$.subscribe((s) => {
      name = s.couriers.get('POA-01')?.name ?? '';
    });
    expect(name).toBe('Ana');
  });

  it('merges position updates into courier state', () => {
    service.connect(sampleCouriers, sampleDeliveries);
    service.mergeEvent('position_update', {
      courier_id: 'POA-01',
      lat: -30.03,
      lng: -51.23,
      timestamp: new Date().toISOString(),
    });
    let lat = 0;
    service.state$.subscribe((s) => {
      lat = s.couriers.get('POA-01')?.position.lat ?? 0;
    });
    expect(lat).toBe(-30.03);
  });

  it('tracks tracking_state_change', () => {
    service.connect(sampleCouriers, sampleDeliveries);
    service.mergeEvent('tracking_state_change', {
      courier_id: 'POA-01',
      tracking_state: 'stale',
      last_seen_at: new Date().toISOString(),
    });
    let state: Courier['tracking_state'] = 'live';
    service.state$.subscribe((s) => {
      state = s.couriers.get('POA-01')?.tracking_state ?? 'live';
    });
    expect(state).toBe('stale');
  });
});
