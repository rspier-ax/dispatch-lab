import { Component, OnInit, OnDestroy, ViewChild, effect } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { DispatchFacadeService } from './dispatch-facade.service';
import { DispatchMapComponent } from '../../components/map/dispatch-map.component';
import { DeliveryListComponent } from '../../components/delivery-list/delivery-list.component';
import { CourierDetailComponent } from '../../components/courier-detail/courier-detail.component';
import { DispatchHeaderComponent } from '../../components/header/dispatch-header.component';
import { DispatchFooterComponent } from '../../components/footer/dispatch-footer.component';
import { DemoCenterModalComponent } from '../../components/demo-center/demo-center-modal.component';
import { DispatchStreamService } from '../../services/dispatch/dispatch-stream.service';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import { Courier, CourierDetail, Delivery, DeliveryEventPayload, DemoInfo, DemoScenario, Landmark } from '../../services/dispatch/types';
import { firstValueFrom } from 'rxjs';
import { courierMetrics, CourierMetrics, TrackingFilter } from '../../lib/dispatch-view.utils';
import { DEFAULT_DEMO_MAP_PREFS, DemoMapPrefs, FALLBACK_DEMO_INFO } from '../../lib/demo.constants';

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
    DemoCenterModalComponent,
  ],
  templateUrl: './dispatch-page.component.html',
  styleUrl: './dispatch-page.component.scss',
})
export class DispatchPageComponent implements OnInit, OnDestroy {
  @ViewChild(DispatchMapComponent) dispatchMap?: DispatchMapComponent;

  couriers: Courier[] = [];
  deliveries: Delivery[] = [];
  landmarks: Landmark[] = [];
  mergedDetail: CourierDetail | null = null;
  metrics: CourierMetrics = { total: 0, live: 0, stale: 0, offline: 0 };
  mapFilter: TrackingFilter = 'all';
  reconnectNotice = false;
  demoInfo: DemoInfo | null = null;
  simTick = 0;
  streamEvents: DeliveryEventPayload[] = [];
  demoCenterOpen = false;
  demoMapPrefs: DemoMapPrefs = { ...DEFAULT_DEMO_MAP_PREFS };

  private sub?: Subscription;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private demoInfoRetryTimer?: ReturnType<typeof setTimeout>;
  private lastTrackingState: string | null = null;

  constructor(
    readonly facade: DispatchFacadeService,
    private readonly stream: DispatchStreamService,
    private readonly provider: HttpDispatchProvider,
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
    await this.loadDemoInfo();
    this.simTick = this.demoInfo?.tick ?? 0;

    this.sub = this.stream.state$.subscribe((state) => {
      this.couriers = this.facade.couriersFromState(state.couriers);
      this.deliveries = this.facade.deliveriesFromState(state.deliveries);
      this.metrics = courierMetrics(this.couriers);
      this.simTick = state.tick;
      this.streamEvents = state.timeline;
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
        if (type === 'delivery_event' && this.facade.selectedCourierId()) {
          const ev = data as DeliveryEventPayload;
          if (ev.courier_id === this.facade.selectedCourierId()) {
            this.facade.refreshCourierDetail(ev.courier_id);
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.demoInfoRetryTimer) clearTimeout(this.demoInfoRetryTimer);
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

  onRunScenario(scenario: DemoScenario): void {
    if (scenario.courier_id) {
      this.onSelect(scenario.courier_id);
    }
    if (scenario.id === 'explore_routes') {
      this.dispatchMap?.fitOperationArea();
    }
    this.demoCenterOpen = false;
  }

  onOpenDemoCenter(): void {
    this.demoCenterOpen = true;
  }

  onCloseDemoCenter(): void {
    this.demoCenterOpen = false;
  }

  onDemoMapPrefsChange(prefs: DemoMapPrefs): void {
    this.demoMapPrefs = prefs;
  }

  onDemoFocusCourier(id: string): void {
    this.onSelect(id);
  }

  async onDemoRefreshed(): Promise<void> {
    await this.facade.init();
    this.landmarks = this.facade.snapshot()?.landmarks ?? [];
    await this.loadDemoInfo();
    this.simTick = this.demoInfo?.tick ?? this.simTick;
  }

  private async loadDemoInfo(): Promise<void> {
    try {
      this.demoInfo = await firstValueFrom(this.provider.getDemoInfo());
      if (this.demoInfoRetryTimer) {
        clearTimeout(this.demoInfoRetryTimer);
        this.demoInfoRetryTimer = undefined;
      }
    } catch {
      if (!this.demoInfo) {
        this.demoInfo = { ...FALLBACK_DEMO_INFO };
      }
      if (!this.demoInfoRetryTimer) {
        this.demoInfoRetryTimer = setTimeout(() => {
          this.demoInfoRetryTimer = undefined;
          void this.loadDemoInfo();
        }, 3000);
      }
    }
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
