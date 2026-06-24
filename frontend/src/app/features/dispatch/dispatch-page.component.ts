import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { DispatchFacadeService } from './dispatch-facade.service';
import { DispatchMapComponent } from '../../components/map/dispatch-map.component';
import { DeliveryListComponent } from '../../components/delivery-list/delivery-list.component';
import { CourierDetailComponent } from '../../components/courier-detail/courier-detail.component';
import { ConnectionIndicatorComponent } from '../../components/connection/connection-indicator.component';
import { DispatchStreamService } from '../../services/dispatch/dispatch-stream.service';
import { Courier, Delivery, CourierDetail } from '../../services/dispatch/types';

@Component({
  selector: 'app-dispatch-page',
  standalone: true,
  imports: [
    AsyncPipe,
    DispatchMapComponent,
    DeliveryListComponent,
    CourierDetailComponent,
    ConnectionIndicatorComponent,
  ],
  template: `
    <div class="shell">
      <header class="shell__header">
        <div>
          <p class="shell__eyebrow">Operador Logístico · Demo</p>
          <h1>DispatchLab — POA Centro</h1>
        </div>
        @if (facade.connection$ | async; as conn) {
          <app-connection-indicator [state]="conn" />
        }
      </header>

      @if (facade.loading()) {
        <div class="shell__state" role="status">Carregando cenário POA Centro…</div>
      } @else if (facade.error()) {
        <div class="shell__state shell__state--error" role="alert">
          <p>{{ facade.error() }}</p>
          <button type="button" (click)="facade.retry()">Tentar novamente</button>
        </div>
      } @else {
        <div class="shell__body">
          <main class="shell__map" id="main-content">
            <app-dispatch-map
              [bounds]="facade.mapBounds()"
              [couriers]="couriers"
              [selectedId]="facade.selectedCourierId()"
            />
          </main>
          <aside class="shell__sidebar">
            <app-delivery-list
              [deliveries]="deliveries"
              [selectedCourierId]="facade.selectedCourierId()"
              (selectCourier)="onSelect($event)"
            />
            <app-courier-detail [detail]="mergedDetail" />
          </aside>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg);
      }
      .shell__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1.25rem;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }
      .shell__eyebrow {
        margin: 0;
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
      }
      .shell__header h1 {
        margin: 0.125rem 0 0;
        font-size: 1.125rem;
      }
      .shell__body {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 360px;
        min-height: 0;
      }
      .shell__map {
        min-height: 0;
      }
      .shell__sidebar {
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--border);
        background: var(--surface);
        min-height: 0;
        overflow: hidden;
      }
      .shell__state {
        flex: 1;
        display: grid;
        place-content: center;
        gap: 0.75rem;
        color: var(--muted);
      }
      .shell__state--error button {
        justify-self: center;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        border: 1px solid var(--border);
        background: var(--surface);
        cursor: pointer;
      }
      @media (max-width: 767px) {
        .shell__body {
          display: none;
        }
        .shell::after {
          content: 'Larger screen required (min 768px).';
          display: grid;
          place-content: center;
          flex: 1;
          padding: 2rem;
          text-align: center;
          color: var(--muted);
        }
      }
    `,
  ],
})
export class DispatchPageComponent implements OnInit, OnDestroy {
  couriers: Courier[] = [];
  deliveries: Delivery[] = [];
  mergedDetail: CourierDetail | null = null;
  private sub?: Subscription;

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
    void this.facade.init();
    this.sub = this.stream.state$.subscribe((state) => {
      this.couriers = this.facade.couriersFromState(state.couriers);
      this.deliveries = this.facade.deliveriesFromState(state.deliveries);
      this.syncDetail();
    });
    this.sub.add(
      this.stream.events$.subscribe(({ type, data }) => {
        if (type === 'tracking_state_change') {
          const ch = data as { courier_id: string };
          if (ch.courier_id === this.facade.selectedCourierId()) {
            this.facade.refreshCourierDetail(ch.courier_id);
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSelect(id: string): void {
    this.facade.selectCourier(id);
    this.syncDetail();
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
    } else {
      this.mergedDetail = base;
    }
  }
}
