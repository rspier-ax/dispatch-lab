import { ResetPreview } from '../../lib/demo-action.types';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DispatchProvider, DeliveryScope } from './dispatch-provider.interface';
import { CourierDetail, Delivery, DemoInfo, ScenarioApplyResult, ScenarioPreview, ScenarioSnapshot } from './types';

@Injectable({ providedIn: 'root' })
export class HttpDispatchProvider extends DispatchProvider {
  private readonly base = environment.apiUrl;

  constructor(private readonly http: HttpClient) {
    super();
  }

  getScenario(): Observable<ScenarioSnapshot> {
    return this.http.get<ScenarioSnapshot>(`${this.base}/api/scenario`);
  }

  getDeliveries(scope: DeliveryScope = 'active'): Observable<Delivery[]> {
    const query = scope === 'delivered' ? '?status=delivered' : '';
    return this.http
      .get<{ deliveries: Delivery[] }>(`${this.base}/api/deliveries${query}`)
      .pipe(map((r) => r.deliveries));
  }

  getCourierDetail(id: string): Observable<CourierDetail> {
    return this.http.get<CourierDetail>(`${this.base}/api/couriers/${id}`);
  }

  getDemoInfo(): Observable<DemoInfo> {
    return this.http.get<DemoInfo>(`${this.base}/api/demo/info`);
  }

  demoReset(): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.base}/api/demo/reset`, {});
  }

  demoAdvance(ticks: number): Observable<{ tick: number }> {
    return this.http.post<{ tick: number }>(`${this.base}/api/demo/advance`, { ticks });
  }

  demoTrigger(courierId: string, action: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.base}/api/demo/trigger`, {
      courier_id: courierId,
      action,
    });
  }

  demoPreviewScenario(scenarioId: string, courierId?: string): Observable<ScenarioPreview> {
    return this.http.post<ScenarioPreview>(`${this.base}/api/demo/preview-scenario`, {
      scenario_id: scenarioId,
      courier_id: courierId || undefined,
    });
  }

  demoApplyScenario(
    scenarioId: string,
    options?: { courierId?: string; confirmReset?: boolean },
  ): Observable<ScenarioApplyResult> {
    return this.http.post<ScenarioApplyResult>(`${this.base}/api/demo/apply-scenario`, {
      scenario_id: scenarioId,
      courier_id: options?.courierId || undefined,
      confirm_reset: options?.confirmReset ?? false,
    });
  }

  demoPreviewReset(): Observable<ResetPreview> {
    return this.http.post<ResetPreview>(`${this.base}/api/demo/preview-reset`, {});
  }
}
