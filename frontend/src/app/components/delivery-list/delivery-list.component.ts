import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Courier, Delivery, TrackingState } from '../../services/dispatch/types';
import {
  courierMatchesFilter,
  deliveryMetaBadge,
  isQueuedDelivery,
  matchesDeliverySearch,
  trackingStateLabel,
  TrackingFilter,
} from '../../lib/dispatch-view.utils';

export type DeliveryListTab = 'active' | 'completed';

interface DeliveryRow {
  delivery: Delivery;
  trackingState: TrackingState;
}

@Component({
  selector: 'app-delivery-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './delivery-list.component.html',
  styleUrl: './delivery-list.component.scss',
})
export class DeliveryListComponent {
  @Input({ required: true }) deliveries: Delivery[] = [];
  @Input({ required: true }) couriers: Courier[] = [];
  @Input() selectedCourierId: string | null = null;
  @Input() filter: TrackingFilter = 'all';
  @Output() selectCourier = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<TrackingFilter>();

  searchQuery = '';
  listTab: DeliveryListTab = 'active';

  readonly filterOptions: { value: TrackingFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'live', label: 'Ao vivo' },
    { value: 'stale', label: 'Sinal atrasado' },
    { value: 'offline', label: 'Sem sinal' },
  ];

  get activeCount(): number {
    return this.deliveries.filter((d) => d.status !== 'delivered').length;
  }

  get completedCount(): number {
    return this.deliveries.filter((d) => d.status === 'delivered').length;
  }

  get listAriaLabel(): string {
    return this.listTab === 'active' ? 'Entregas ativas' : 'Entregas concluídas';
  }

  get rows(): DeliveryRow[] {
    const courierById = new Map(this.couriers.map((c) => [c.id, c]));
    return this.deliveries
      .filter((delivery) =>
        this.listTab === 'active'
          ? delivery.status !== 'delivered'
          : delivery.status === 'delivered',
      )
      .map((delivery) => {
        const courier = courierById.get(delivery.courier_id);
        const trackingState = courier?.tracking_state ?? 'offline';
        return { delivery, trackingState };
      })
      .filter(({ delivery, trackingState }) => {
        if (!matchesDeliverySearch(this.searchQuery, delivery)) return false;
        if (this.listTab === 'completed') return true;
        return courierMatchesFilter(trackingState, this.filter);
      });
  }

  setListTab(tab: DeliveryListTab): void {
    this.listTab = tab;
  }

  onFilterChange(value: string): void {
    this.filterChange.emit(value as TrackingFilter);
  }

  trackingLabel = trackingStateLabel;
  deliveryMetaBadge = deliveryMetaBadge;
  isQueued = isQueuedDelivery;
}
