export type TrackingState = 'live' | 'stale' | 'offline';
export type DeliveryStatus = 'picking_up' | 'in_transit' | 'delivered';
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface Position {
  lat: number;
  lng: number;
}

export interface MapBounds {
  min_lng: number;
  max_lng: number;
  min_lat: number;
  max_lat: number;
  center_lat: number;
  center_lng: number;
}

export interface Landmark {
  id: string;
  name: string;
  pos: Position;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface Courier {
  id: string;
  name: string;
  position: Position;
  tracking_state: TrackingState;
  last_seen_at: string;
  route: RoutePoint[];
  route_index: number;
  route_progress: number;
  speed_mps: number;
  delivery_id: string;
  eta_seconds: number;
}

export interface Delivery {
  id: string;
  courier_id: string;
  courier_name: string;
  restaurant: string;
  street: string;
  pickup: Position;
  dropoff: Position;
  status: DeliveryStatus;
  customer_name: string;
  eta_seconds: number;
}

export interface TimelineEvent {
  id: string;
  courier_id: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface ScenarioSnapshot {
  map_bounds: MapBounds;
  landmarks: Landmark[];
  couriers: Courier[];
  deliveries: Delivery[];
  tick: number;
}

export interface CourierDetail {
  courier: Courier;
  delivery?: Delivery;
  timeline: TimelineEvent[];
}

export interface PositionUpdate {
  courier_id: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface TrackingStateChange {
  courier_id: string;
  tracking_state: TrackingState;
  last_seen_at: string;
}

export interface ETAUpdate {
  delivery_id: string;
  courier_id: string;
  eta_seconds: number;
}

export interface DeliveryEventPayload {
  delivery_id?: string;
  courier_id: string;
  type: string;
  status?: DeliveryStatus;
  message: string;
  timestamp: string;
}
