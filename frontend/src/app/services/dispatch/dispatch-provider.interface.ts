import { Observable } from 'rxjs';
import { CourierDetail, Delivery, DemoInfo, ScenarioSnapshot } from './types';

export type DeliveryScope = 'active' | 'delivered';

export abstract class DispatchProvider {
  abstract getScenario(): Observable<ScenarioSnapshot>;
  abstract getDeliveries(scope?: DeliveryScope): Observable<Delivery[]>;
  abstract getCourierDetail(id: string): Observable<CourierDetail>;
  abstract getDemoInfo(): Observable<DemoInfo>;
  abstract demoReset(): Observable<{ status: string }>;
  abstract demoAdvance(ticks: number): Observable<{ tick: number }>;
  abstract demoTrigger(courierId: string, action: string): Observable<{ status: string }>;
}
