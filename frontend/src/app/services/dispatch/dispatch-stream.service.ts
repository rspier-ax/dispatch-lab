import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConnectionState,
  Courier,
  Delivery,
  DeliveryEventPayload,
  ETAUpdate,
  PositionUpdate,
  TrackingStateChange,
} from './types';

export interface StreamState {
  couriers: Map<string, Courier>;
  deliveries: Map<string, Delivery>;
  timeline: DeliveryEventPayload[];
}

@Injectable({ providedIn: 'root' })
export class DispatchStreamService implements OnDestroy {
  private source: EventSource | null = null;
  private readonly connectionSubject = new BehaviorSubject<ConnectionState>('disconnected');
  private readonly stateSubject = new BehaviorSubject<StreamState>({
    couriers: new Map(),
    deliveries: new Map(),
    timeline: [],
  });

  readonly connection$ = this.connectionSubject.asObservable();
  readonly state$ = this.stateSubject.asObservable();
  readonly events$ = new Subject<{ type: string; data: unknown }>();

  constructor(private readonly zone: NgZone) {}

  connect(initialCouriers: Courier[], initialDeliveries: Delivery[]): void {
    this.disconnect();
    const state: StreamState = {
      couriers: new Map(initialCouriers.map((c) => [c.id, { ...c }])),
      deliveries: new Map(initialDeliveries.map((d) => [d.id, { ...d }])),
      timeline: [],
    };
    this.stateSubject.next(state);
    this.connectionSubject.next('reconnecting');

    const url = `${environment.apiUrl}/api/stream`;
    this.source = new EventSource(url);

    this.source.onopen = () => {
      this.zone.run(() => this.connectionSubject.next('connected'));
    };

    this.source.onerror = () => {
      this.zone.run(() => {
        if (this.source?.readyState === EventSource.CONNECTING) {
          this.connectionSubject.next('reconnecting');
        } else {
          this.connectionSubject.next('disconnected');
        }
      });
    };

    this.source.addEventListener('position_update', (e) => {
      this.handleEvent('position_update', e as MessageEvent);
    });
    this.source.addEventListener('tracking_state_change', (e) => {
      this.handleEvent('tracking_state_change', e as MessageEvent);
    });
    this.source.addEventListener('eta_update', (e) => {
      this.handleEvent('eta_update', e as MessageEvent);
    });
    this.source.addEventListener('delivery_event', (e) => {
      this.handleEvent('delivery_event', e as MessageEvent);
    });
  }

  disconnect(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this.connectionSubject.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private handleEvent(type: string, event: MessageEvent): void {
    this.zone.run(() => {
      try {
        const data = JSON.parse(event.data as string);
        this.mergeEvent(type, data);
        this.events$.next({ type, data });
      } catch {
        // ignore malformed payloads
      }
    });
  }

  /** Merges a stream payload into local state (used by SSE handler and unit tests). */
  mergeEvent(type: string, data: unknown): void {
    const current = this.stateSubject.value;
    const couriers = new Map(current.couriers);
    const deliveries = new Map(current.deliveries);
    let timeline = [...current.timeline];

    if (type === 'position_update') {
      const u = data as PositionUpdate;
      const c = couriers.get(u.courier_id);
      if (c) {
        couriers.set(u.courier_id, {
          ...c,
          position: { lat: u.lat, lng: u.lng },
          last_seen_at: u.timestamp,
        });
      }
    }

    if (type === 'tracking_state_change') {
      const ch = data as TrackingStateChange;
      const c = couriers.get(ch.courier_id);
      if (c) {
        couriers.set(ch.courier_id, {
          ...c,
          tracking_state: ch.tracking_state,
          last_seen_at: ch.last_seen_at,
        });
      }
    }

    if (type === 'eta_update') {
      const eta = data as ETAUpdate;
      const d = deliveries.get(eta.delivery_id);
      if (d) {
        deliveries.set(eta.delivery_id, { ...d, eta_seconds: eta.eta_seconds });
      }
      const c = couriers.get(eta.courier_id);
      if (c) {
        couriers.set(eta.courier_id, { ...c, eta_seconds: eta.eta_seconds });
      }
    }

    if (type === 'delivery_event') {
      const ev = data as DeliveryEventPayload;
      timeline = [...timeline, ev].slice(-50);
    }

    this.stateSubject.next({ couriers, deliveries, timeline });
  }
}
