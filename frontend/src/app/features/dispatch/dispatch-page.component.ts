import { Component, OnInit, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { DispatchFacadeService } from './dispatch-facade.service';
import { DispatchMapComponent } from '../../components/map/dispatch-map.component';
import { DeliveryListComponent } from '../../components/delivery-list/delivery-list.component';
import { CourierDetailComponent } from '../../components/courier-detail/courier-detail.component';
import { DispatchHeaderComponent } from '../../components/header/dispatch-header.component';
import { DispatchBootComponent } from '../../components/boot/dispatch-boot.component';
import { DispatchStreamService } from '../../services/dispatch/dispatch-stream.service';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import {
  Courier,
  CourierDetail,
  Delivery,
  DemoInfo,
  Landmark,
  PlatformFeedItem,
  ScenarioApplyResult,
  ScriptAction,
} from '../../services/dispatch/types';
import { firstValueFrom } from 'rxjs';
import {
  courierMetrics,
  CourierMetrics,
  DeliveryPhaseFilter,
  TrackingFilter,
} from '../../lib/dispatch-view.utils';
import { DEFAULT_DEMO_MAP_PREFS, DemoMapPrefs, DEMO_RESET_MIN_MS, FALLBACK_DEMO_INFO } from '../../lib/demo.constants';

@Component({
  selector: 'app-dispatch-page',
  standalone: true,
  imports: [
    AsyncPipe,
    DispatchMapComponent,
    DeliveryListComponent,
    CourierDetailComponent,
    DispatchHeaderComponent,
    DispatchBootComponent,
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
  streamPlatformFeed: PlatformFeedItem[] = [];
  upcomingScripts: ScriptAction[] = [];
  tickIntervalMs = 1000;
  demoCenterOpen = false;
  demoMapPrefs: DemoMapPrefs = { ...DEFAULT_DEMO_MAP_PREFS };
  demoResetting = signal(false);
  deliveryPhaseFilterOverride = signal<DeliveryPhaseFilter | null>(null);

  private sub?: Subscription;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private demoInfoRetryTimer?: ReturnType<typeof setTimeout>;
  private lastTrackingState: string | null = null;

  readonly refreshDemo = async (): Promise<void> => {
    this.demoResetting.set(true);
    const startedAt = Date.now();
    try {
      this.onCloseDetail();
      this.demoMapPrefs = { ...DEFAULT_DEMO_MAP_PREFS };
      this.deliveryPhaseFilterOverride.set(null);
      await this.facade.init();
      this.landmarks = this.facade.snapshot()?.landmarks ?? [];
      await this.loadDemoInfo();
      this.simTick = this.demoInfo?.tick ?? 0;
      this.syncStreamScripts();
    } finally {
      const remaining = DEMO_RESET_MIN_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      this.demoResetting.set(false);
    }
  };

  readonly reloadDemoInfo = async (): Promise<void> => {
    await this.loadDemoInfo();
    this.simTick = this.demoInfo?.tick ?? this.simTick;
    this.syncStreamScripts();
  };

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
    this.syncStreamScripts();

    this.sub = this.stream.state$.subscribe((state) => {
      this.couriers = this.facade.couriersFromState(state.couriers);
      this.deliveries = this.facade.deliveriesFromState(state.deliveries);
      this.metrics = courierMetrics(this.couriers);
      this.simTick = state.tick;
      this.streamPlatformFeed = state.platformFeed;
      this.upcomingScripts = state.upcomingScripts;
      this.tickIntervalMs = state.tickIntervalMs;
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
          const ev = data as { courier_id: string };
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

  onScenarioApplied(result: ScenarioApplyResult): void {
    if (result.scripts?.length) {
      this.stream.seedUpcomingScripts(result.scripts);
    } else {
      this.syncStreamScripts();
    }
    if (result.queue_focus) {
      this.deliveryPhaseFilterOverride.set('queued');
    }
    if (result.focused_courier_id) {
      this.onSelect(result.focused_courier_id);
    }
    if (result.fit_map) {
      this.dispatchMap?.fitOperationArea();
    }
  }

  onToggleDemoCenter(): void {
    this.demoCenterOpen = !this.demoCenterOpen;
  }

  onCloseDemoCenter(): void {
    this.demoCenterOpen = false;
  }

  onDemoMapPrefsChange(prefs: DemoMapPrefs): void {
    this.demoMapPrefs = prefs;
  }

  bootMessage(): string {
    return this.demoResetting() ? 'Reiniciando demo…' : 'Carregando operação…';
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

  private syncStreamScripts(): void {
    if (this.demoInfo?.scripts?.length) {
      this.stream.seedUpcomingScripts(this.demoInfo.scripts);
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
