import { Observable } from 'rxjs';
import { CourierDetail, Delivery, ScenarioSnapshot } from './types';

export abstract class DispatchProvider {
  abstract getScenario(): Observable<ScenarioSnapshot>;
  abstract getDeliveries(): Observable<Delivery[]>;
  abstract getCourierDetail(id: string): Observable<CourierDetail>;
}
