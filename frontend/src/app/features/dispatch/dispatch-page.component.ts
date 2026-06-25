import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { DispatchFacadeService } from './dispatch-facade.service';
import { DispatchMapComponent } from '../../components/map/dispatch-map.component';
import { DeliveryListComponent } from '../../components/delivery-list/delivery-list.component';
import { CourierDetailComponent } from '../../components/courier-detail/courier-detail.component';
import { DispatchHeaderComponent } from '../../components/header/dispatch-header.component';
import { DispatchFooterComponent } from '../../components/footer/dispatch-footer.component';
import { DispatchStreamService } from '../../services/dispatch/dispatch-stream.service';
import { Courier, CourierDetail, Delivery, Landmark } from '../../services/dispatch/types';
import { courierMetrics, CourierMetrics, TrackingFilter } from '../../lib/dispatch-view.utils';

@Component({
  selector: 'app-dispatch-page',
  standalone: true,
  imports: [
    AsyncPipe,
    DispatchMapComponent,
    DeliveryListComponent,
    CourierDetailComponent,
    DispatchHeaderComponent,
    DispatchFooterComponent,
  ],
  templateUrl: './dispatch-page.component.html',
  styleUrl: './dispatch-page.component.scss',
})
export class DispatchPageComponent implements OnInit, OnDestroy {
  couriers: Courier[] = [];
  deliveries: Delivery[] = [];
  landmarks: Landmark[] = [];
  mergedDetail: CourierDetail | null = null;
  metrics: CourierMetrics = { total: 0, live: 0, stale: 0, offline: 0 };
  mapFilter: TrackingFilter = 'all';
  reconnectNotice = false;

  private sub?: Subscription;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private lastTrackingState: string | null = null;

  constructor(
    readonly facade: DispatchFacadeService,
    private readonly stream: DispatchStreamService,
  ) {
    effect(() => {
      this.facade.courierDetail();
      this.facade.selectedCourierId();
      this.syncDetail();
    });
  }

  ngOnInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.facade.init();
    this.landmarks = this.facade.snapshot()?.landmarks ?? [];

    this.sub = this.stream.state$.subscribe((state) => {
      this.couriers = this.facade.couriersFromState(state.couriers);
      this.deliveries = this.facade.deliveriesFromState(state.deliveries);
      this.metrics = courierMetrics(this.couriers);
      this.syncDetail();
    });

    this.sub.add(
      this.stream.events$.subscribe(({ type, data }) => {
        if (type === 'tracking_state_change') {
          const ch = data as { courier_id: string; tracking_state: string };
          if (ch.courier_id === this.facade.selectedCourierId()) {
            this.facade.refreshCourierDetail(ch.courier_id);
            if (ch.tracking_state === 'live' && this.lastTrackingState === 'stale') {
              this.showReconnectNotice();
            }
            this.lastTrackingState = ch.tracking_state;
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  onSelect(id: string): void {
    this.facade.selectCourier(id);
    const courier = this.couriers.find((c) => c.id === id);
    this.lastTrackingState = courier?.tracking_state ?? null;
    this.syncDetail();
  }

  onCloseDetail(): void {
    this.facade.selectCourier(null);
    this.mergedDetail = null;
    this.lastTrackingState = null;
  }

  onFilterChange(filter: TrackingFilter): void {
    this.mapFilter = filter;
  }

  private syncDetail(): void {
    const base = this.facade.courierDetail();
    const id = this.facade.selectedCourierId();
    if (!base || !id) {
      this.mergedDetail = base;
      return;
    }
    const live = this.couriers.find((c) => c.id === id);
    if (live) {
      this.mergedDetail = { ...base, courier: live };
      if (!this.lastTrackingState) {
        this.lastTrackingState = live.tracking_state;
      }
    } else {
      this.mergedDetail = base;
    }
  }

  private showReconnectNotice(): void {
    this.reconnectNotice = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectNotice = false;
    }, 8000);
  }
}
