import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Courier, Delivery, TrackingState } from '../../services/dispatch/types';
import {
  compareDeliveriesForSort,
  courierMatchesFilter,
  deliveryMetaBadge,
  DeliveryPhaseFilter,
  DeliverySort,
  isQueuedDelivery,
  matchesDeliverySearch,
  matchesPhaseFilter,
  trackingStateLabel,
  TrackingFilter,
} from '../../lib/dispatch-view.utils';

export type DeliveryListTab = 'active' | 'completed';

interface DeliveryRow {
  delivery: Delivery;
  trackingState: TrackingState;
  queued: boolean;
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
  phaseFilter: DeliveryPhaseFilter = 'all';
  courierFilter = '';
  sortBy: DeliverySort = 'eta';

  readonly filterOptions: { value: TrackingFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'live', label: 'Ao vivo' },
    { value: 'stale', label: 'Sinal atrasado' },
    { value: 'offline', label: 'Sem sinal' },
  ];

  readonly phaseOptions: { value: DeliveryPhaseFilter; label: string }[] = [
    { value: 'all', label: 'Todas fases' },
    { value: 'queued', label: 'Na fila' },
    { value: 'picking_up', label: 'Coletando' },
    { value: 'in_transit', label: 'Em rota' },
  ];

  readonly sortOptions: { value: DeliverySort; label: string }[] = [
    { value: 'eta', label: 'ETA ↑' },
    { value: 'restaurant', label: 'Restaurante A–Z' },
    { value: 'id', label: 'ID' },
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

  get sortOptionsForTab(): { value: DeliverySort; label: string }[] {
    if (this.listTab === 'completed') {
      return this.sortOptions.filter((o) => o.value !== 'eta');
    }
    return this.sortOptions;
  }

  get rows(): DeliveryRow[] {
    const courierById = new Map(this.couriers.map((c) => [c.id, c]));
    const filtered = this.deliveries
      .filter((delivery) =>
        this.listTab === 'active'
          ? delivery.status !== 'delivered'
          : delivery.status === 'delivered',
      )
      .map((delivery) => {
        const courier = courierById.get(delivery.courier_id);
        const trackingState = courier?.tracking_state ?? 'offline';
        const queued = isQueuedDelivery(delivery, this.couriers);
        return { delivery, trackingState, queued };
      })
      .filter(({ delivery, trackingState, queued }) => {
        if (!matchesDeliverySearch(this.searchQuery, delivery)) return false;
        if (this.courierFilter && delivery.courier_id !== this.courierFilter) return false;
        if (this.listTab === 'completed') return true;
        if (!courierMatchesFilter(trackingState, this.filter)) return false;
        return matchesPhaseFilter(this.phaseFilter, delivery, this.couriers, queued);
      });

    const sort = this.listTab === 'completed' && this.sortBy === 'eta' ? 'restaurant' : this.sortBy;
    return filtered.sort((a, b) =>
      compareDeliveriesForSort(a.delivery, b.delivery, sort, a.queued, b.queued),
    );
  }

  setListTab(tab: DeliveryListTab): void {
    this.listTab = tab;
    if (tab === 'completed' && this.sortBy === 'eta') {
      this.sortBy = 'restaurant';
    }
  }

  onFilterChange(value: string): void {
    this.filterChange.emit(value as TrackingFilter);
  }

  trackingLabel = trackingStateLabel;
  deliveryMetaBadge = deliveryMetaBadge;
  isQueued = isQueuedDelivery;
}
