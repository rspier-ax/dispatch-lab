import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CourierDetail } from '../../services/dispatch/types';

@Component({
  selector: 'app-courier-detail',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    @if (detail) {
      <section class="detail" aria-labelledby="courier-heading">
        <header class="detail__header">
          <h2 id="courier-heading">{{ detail.courier.id }}</h2>
          <span class="badge" [class]="'badge--' + detail.courier.tracking_state">
            {{ trackingLabel(detail.courier.tracking_state) }}
          </span>
        </header>
        <p class="detail__name">{{ detail.courier.name }}</p>
        <dl class="detail__stats">
          <div>
            <dt>Última atualização</dt>
            <dd>{{ detail.courier.last_seen_at | date: 'HH:mm:ss' }}</dd>
          </div>
          <div>
            <dt>ETA</dt>
            <dd>{{ formatEta(detail.courier.eta_seconds) }}</dd>
          </div>
        </dl>
        @if (detail.delivery) {
          <div class="detail__delivery">
            <h3>Entrega {{ detail.delivery.id }}</h3>
            <p>{{ detail.delivery.restaurant }} · {{ detail.delivery.street }}</p>
            <p class="detail__customer">Cliente: {{ detail.delivery.customer_name }}</p>
          </div>
        }
        <div class="detail__timeline">
          <h3>Últimos eventos</h3>
          @if (detail.timeline.length === 0) {
            <p class="detail__empty">Sem eventos registrados.</p>
          } @else {
            <ol>
              @for (ev of detail.timeline; track ev.id) {
                <li>
                  <time>{{ ev.timestamp | date: 'HH:mm:ss' }}</time>
                  <span>{{ ev.message }}</span>
                </li>
              }
            </ol>
          }
        </div>
      </section>
    } @else {
      <section class="detail detail--empty">
        <p>Selecione um entregador no mapa ou na lista para ver rota, status e eventos.</p>
      </section>
    }
  `,
  styles: [
    `
      .detail {
        padding: 1rem;
        border-top: 1px solid var(--border);
        overflow: auto;
      }
      .detail--empty {
        color: var(--muted);
        font-size: 0.875rem;
      }
      .detail__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .detail__header h2 {
        margin: 0;
        font-size: 1rem;
      }
      .detail__name {
        margin: 0.25rem 0 0.75rem;
        color: var(--muted);
        font-size: 0.875rem;
      }
      .badge {
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
      }
      .badge--live {
        background: #dcfce7;
        color: #15803d;
      }
      .badge--stale {
        background: #fef3c7;
        color: #b45309;
      }
      .badge--offline {
        background: #f1f5f9;
        color: #64748b;
      }
      .detail__stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        margin: 0 0 1rem;
      }
      .detail__stats dt {
        font-size: 0.6875rem;
        text-transform: uppercase;
        color: var(--muted);
      }
      .detail__stats dd {
        margin: 0;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .detail__delivery h3,
      .detail__timeline h3 {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 0 0 0.5rem;
        color: var(--muted);
      }
      .detail__delivery p {
        margin: 0 0 0.25rem;
        font-size: 0.8125rem;
      }
      .detail__customer {
        color: var(--muted);
      }
      .detail__timeline ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .detail__timeline li {
        display: grid;
        grid-template-columns: 4.5rem 1fr;
        gap: 0.5rem;
        font-size: 0.8125rem;
      }
      .detail__timeline time {
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }
      .detail__empty {
        font-size: 0.8125rem;
        color: var(--muted);
      }
    `,
  ],
})
export class CourierDetailComponent {
  @Input() detail: CourierDetail | null = null;

  trackingLabel(state: CourierDetail['courier']['tracking_state']): string {
    switch (state) {
      case 'live':
        return 'Ao vivo';
      case 'stale':
        return 'Stale';
      default:
        return 'Offline';
    }
  }

  formatEta(seconds: number): string {
    if (seconds <= 0) return '—';
    return `${Math.ceil(seconds / 60)} min`;
  }
}
