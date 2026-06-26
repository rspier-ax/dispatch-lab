import { Injectable, signal } from '@angular/core';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import { DispatchStreamService } from '../../services/dispatch/dispatch-stream.service';
import {
  Courier,
  CourierDetail,
  Delivery,
  MapBounds,
  ScenarioSnapshot,
} from '../../services/dispatch/types';
import { firstValueFrom, timeout, filter, take, catchError, of } from 'rxjs';

const SSE_CONNECT_TIMEOUT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class DispatchFacadeService {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly snapshot = signal<ScenarioSnapshot | null>(null);
  readonly selectedCourierId = signal<string | null>(null);
  readonly courierDetail = signal<CourierDetail | null>(null);

  constructor(
    private readonly provider: HttpDispatchProvider,
    private readonly stream: DispatchStreamService,
  ) {}

  get connection$() {
    return this.stream.connection$;
  }

  get streamState$() {
    return this.stream.state$;
  }

  async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const snap = await firstValueFrom(this.provider.getScenario());
      this.snapshot.set(snap);
      this.stream.connect(snap.couriers, snap.deliveries);
      await firstValueFrom(
        this.stream.connection$.pipe(
          filter((state) => state === 'connected'),
          take(1),
          timeout(SSE_CONNECT_TIMEOUT_MS),
          catchError(() => of(null)),
        ),
      );
    } catch {
      this.error.set('Não foi possível carregar o cenário POA Centro.');
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    this.stream.disconnect();
    void this.init();
  }

  mapBounds(): MapBounds | null {
    return this.snapshot()?.map_bounds ?? null;
  }

  selectCourier(id: string | null): void {
    this.selectedCourierId.set(id);
    this.courierDetail.set(null);
    if (!id) return;
    firstValueFrom(this.provider.getCourierDetail(id))
      .then((detail) => this.courierDetail.set(detail))
      .catch(() => this.courierDetail.set(null));
  }

  refreshCourierDetail(id: string): void {
    if (this.selectedCourierId() !== id) return;
    firstValueFrom(this.provider.getCourierDetail(id))
      .then((detail) => this.courierDetail.set(detail))
      .catch(() => undefined);
  }

  couriersFromState(couriers: Map<string, Courier>): Courier[] {
    return Array.from(couriers.values());
  }

  deliveriesFromState(deliveries: Map<string, Delivery>): Delivery[] {
    return Array.from(deliveries.values());
  }
}
