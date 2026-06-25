import {
  Courier,
  RoutePoint,
  TimelineEvent,
  TrackingState,
} from '../services/dispatch/types';

export interface CourierMetrics {
  total: number;
  live: number;
  stale: number;
  offline: number;
}

export type TrackingFilter = 'all' | TrackingState;

export interface TimelineDisplay {
  title: string;
  description: string;
  tone: 'stale' | 'operational' | 'neutral';
}

export function courierMetrics(couriers: Courier[]): CourierMetrics {
  return {
    total: couriers.length,
    live: couriers.filter((c) => c.tracking_state === 'live').length,
    stale: couriers.filter((c) => c.tracking_state === 'stale').length,
    offline: couriers.filter((c) => c.tracking_state === 'offline').length,
  };
}

export function trackingStateLabel(state: TrackingState): string {
  switch (state) {
    case 'live':
      return 'Ao vivo';
    case 'stale':
      return 'Sinal atrasado';
    default:
      return 'Sem sinal';
  }
}

export function trackingStateShortLabel(state: TrackingState): string {
  switch (state) {
    case 'live':
      return 'Ao vivo';
    case 'stale':
      return 'Sinal atrasado';
    default:
      return 'Sem sinal';
  }
}

export function deliveryPhaseLabel(status: string): string {
  switch (status) {
    case 'picking_up':
      return 'Coletando';
    case 'in_transit':
      return 'Em rota';
    case 'delivered':
      return 'Entregue';
    default:
      return status;
  }
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.ceil(seconds / 60);
  return `${m} min`;
}

export function formatEtaLabel(seconds: number): string {
  if (seconds <= 0) return 'ETA calculando…';
  return `ETA ${formatEta(seconds)}`;
}

export function isQueuedDelivery(
  delivery: { id: string; courier_id: string },
  couriers: Courier[],
): boolean {
  const courier = couriers.find((c) => c.id === delivery.courier_id);
  return courier != null && courier.delivery_id !== delivery.id;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour12: false });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour12: false });
}

export function staleAgeSeconds(lastSeenAt: string, now = Date.now()): number {
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 1000));
}

export function formatSignalAge(seconds: number): string {
  if (seconds <= 0) return 'ao vivo';
  if (seconds < 60) return `sinal há ${seconds}s`;
  const m = Math.floor(seconds / 60);
  return `sinal há ${m} min`;
}

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function remainingDistanceM(courier: Courier): number {
  const route = courier.route;
  if (route.length < 2) return 0;
  const idx = courier.route_index;
  if (idx >= route.length - 1) return 0;

  let total = 0;
  const a = route[idx];
  const b = route[idx + 1];
  const segLen = haversineM(a.lat, a.lng, b.lat, b.lng);
  total += segLen * (1 - courier.route_progress);
  for (let i = idx + 1; i < route.length - 1; i++) {
    total += haversineM(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
  }
  return total;
}

export function formatDistanceM(meters: number): string {
  if (meters <= 0) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export function formatBbox(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
): string {
  const f = (n: number) => n.toFixed(3);
  return `BBox: ${f(minLng)}, ${f(minLat)}, ${f(maxLng)}, ${f(maxLat)}`;
}

export function timelineDisplay(event: TimelineEvent): TimelineDisplay {
  switch (event.type) {
    case 'went_stale':
      return {
        title: 'Sinal do entregador interrompido',
        description: 'Última posição conhecida',
        tone: 'stale',
      };
    case 'reconnected':
      return {
        title: 'Conexão restabelecida',
        description: event.message,
        tone: 'operational',
      };
    case 'started':
      return {
        title: 'Rota iniciada',
        description: event.message,
        tone: 'neutral',
      };
    case 'arrived_pickup':
      return {
        title: 'Chegou ao restaurante',
        description: event.message,
        tone: 'operational',
      };
    case 'picked_up':
      return {
        title: 'Pedido coletado',
        description: event.message,
        tone: 'operational',
      };
    case 'approaching_dropoff':
      return {
        title: 'Próximo ao destino',
        description: event.message,
        tone: 'operational',
      };
    default:
      return {
        title: event.message,
        description: '',
        tone: 'operational',
      };
  }
}

export function matchesDeliverySearch(
  query: string,
  delivery: { id: string; restaurant: string; street: string; courier_id: string; courier_name: string },
): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [delivery.id, delivery.restaurant, delivery.street, delivery.courier_id, delivery.courier_name]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export function courierMatchesFilter(state: TrackingState, filter: TrackingFilter): boolean {
  if (filter === 'all') return true;
  return state === filter;
}

export function markerClass(
  state: TrackingState,
  selected: boolean,
  pulseOnce: boolean,
  highlighted = false,
): string {
  const classes = ['dispatch-marker', `dispatch-marker--${state}`];
  if (selected) classes.push('dispatch-marker--selected');
  if (highlighted && !selected) classes.push('dispatch-marker--highlighted');
  if (pulseOnce && state === 'stale') classes.push('dispatch-marker--pulse-once');
  return classes.join(' ');
}

export function routePointsToLatLngs(route: RoutePoint[]): [number, number][] {
  return route.map((p) => [p.lat, p.lng]);
}

export function remainingRouteLatLngs(courier: Courier): [number, number][] {
  const { route, route_index, position } = courier;
  if (route.length < 2) {
    return [[position.lat, position.lng]];
  }
  if (route_index >= route.length - 1) {
    return [[position.lat, position.lng]];
  }
  const pts: [number, number][] = [[position.lat, position.lng]];
  for (let i = route_index + 1; i < route.length; i++) {
    pts.push([route[i].lat, route[i].lng]);
  }
  return pts;
}

export function traveledRouteLatLngs(courier: Courier): [number, number][] {
  const { route, route_index, position } = courier;
  if (route.length < 2 || route_index <= 0) {
    return [];
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= route_index; i++) {
    pts.push([route[i].lat, route[i].lng]);
  }
  pts.push([position.lat, position.lng]);
  return pts;
}
