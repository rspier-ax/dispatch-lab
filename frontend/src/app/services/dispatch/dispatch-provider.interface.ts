import { ResetPreview } from '../../lib/demo-action.types';
import { Observable } from 'rxjs';
import { CourierDetail, Delivery, DemoInfo, ScenarioApplyResult, ScenarioPreview, ScenarioSnapshot } from './types';

export type DeliveryScope = 'active' | 'delivered';

export abstract class DispatchProvider {
  abstract getScenario(): Observable<ScenarioSnapshot>;
  abstract getDeliveries(scope?: DeliveryScope): Observable<Delivery[]>;
  abstract getCourierDetail(id: string): Observable<CourierDetail>;
  abstract getDemoInfo(): Observable<DemoInfo>;
  abstract demoReset(): Observable<{ status: string }>;
  abstract demoAdvance(ticks: number): Observable<{ tick: number }>;
  abstract demoTrigger(courierId: string, action: string): Observable<{ status: string }>;
  abstract demoPreviewScenario(
    scenarioId: string,
    courierId?: string,
  ): Observable<ScenarioPreview>;
  abstract demoApplyScenario(
    scenarioId: string,
    options?: { courierId?: string; confirmReset?: boolean },
  ): Observable<ScenarioApplyResult>;
  abstract demoPreviewReset(): Observable<ResetPreview>;
}
