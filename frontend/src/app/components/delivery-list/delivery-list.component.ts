import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Delivery } from '../../services/dispatch/types';

@Component({
  selector: 'app-delivery-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="panel" aria-labelledby="deliveries-heading">
      <header class="panel__header">
        <h2 id="deliveries-heading">Entregas ativas</h2>
        <span class="panel__count">{{ deliveries.length }}</span>
      </header>
      @if (deliveries.length === 0) {
        <p class="panel__empty">Nenhuma entrega ativa no momento.</p>
      } @else {
        <ul class="delivery-list">
          @for (d of deliveries; track d.id) {
            <li>
              <button
                type="button"
                class="delivery-item"
                [class.delivery-item--selected]="d.courier_id === selectedCourierId"
                (click)="selectCourier.emit(d.courier_id)"
              >
                <span class="delivery-item__id">{{ d.id }}</span>
                <span class="delivery-item__name">{{ d.restaurant }}</span>
                <span class="delivery-item__street">{{ d.street }}</span>
                <span class="delivery-item__meta">
                  <span>{{ statusLabel(d.status) }}</span>
                  <span>{{ d.courier_id }} · ETA {{ formatEta(d.eta_seconds) }}</span>
                </span>
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border);
      }
      .panel__header h2 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .panel__count {
        font-size: 0.75rem;
        color: var(--muted);
        background: var(--surface-alt);
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
      }
      .panel__empty {
        padding: 1rem;
        color: var(--muted);
        font-size: 0.875rem;
      }
      .delivery-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow: auto;
        flex: 1;
      }
      .delivery-item {
        width: 100%;
        text-align: left;
        border: none;
        border-bottom: 1px solid var(--border);
        background: transparent;
        padding: 0.75rem 1rem;
        cursor: pointer;
        display: grid;
        gap: 0.125rem;
      }
      .delivery-item:hover,
      .delivery-item--selected {
        background: var(--surface-alt);
      }
      .delivery-item--selected {
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .delivery-item__id {
        font-size: 0.6875rem;
        color: var(--muted);
        font-weight: 600;
      }
      .delivery-item__name {
        font-size: 0.875rem;
        font-weight: 600;
      }
      .delivery-item__street {
        font-size: 0.8125rem;
        color: var(--muted);
      }
      .delivery-item__meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--muted);
        margin-top: 0.25rem;
      }
    `,
  ],
})
export class DeliveryListComponent {
  @Input({ required: true }) deliveries: Delivery[] = [];
  @Input() selectedCourierId: string | null = null;
  @Output() selectCourier = new EventEmitter<string>();

  statusLabel(status: Delivery['status']): string {
    switch (status) {
      case 'picking_up':
        return 'Coletando';
      case 'in_transit':
        return 'Em trânsito';
      default:
        return status;
    }
  }

  formatEta(seconds: number): string {
    if (seconds <= 0) return '—';
    const m = Math.ceil(seconds / 60);
    return `${m} min`;
  }
}
