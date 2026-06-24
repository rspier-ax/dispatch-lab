import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionState } from '../../services/dispatch/types';

@Component({
  selector: 'app-connection-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="connection"
      [class.connection--connected]="state === 'connected'"
      [class.connection--reconnecting]="state === 'reconnecting'"
      [class.connection--disconnected]="state === 'disconnected'"
      role="status"
      [attr.aria-label]="label"
      aria-live="polite"
    >
      <span class="connection__dot" aria-hidden="true"></span>
      {{ label }}
    </span>
  `,
  styles: [
    `
      .connection {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.25rem 0.625rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface);
      }
      .connection__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
      }
      .connection--connected {
        color: #15803d;
      }
      .connection--reconnecting {
        color: #b45309;
      }
      .connection--disconnected {
        color: #b91c1c;
      }
    `,
  ],
})
export class ConnectionIndicatorComponent {
  @Input({ required: true }) state: ConnectionState = 'disconnected';

  get label(): string {
    switch (this.state) {
      case 'connected':
        return 'Conectado';
      case 'reconnecting':
        return 'Reconectando…';
      default:
        return 'Desconectado';
    }
  }
}
