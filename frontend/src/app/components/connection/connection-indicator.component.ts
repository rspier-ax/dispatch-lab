import { Component, Input } from '@angular/core';
import { ConnectionState } from '../../services/dispatch/types';

@Component({
  selector: 'app-connection-indicator',
  standalone: true,
  templateUrl: './connection-indicator.component.html',
  styleUrl: './connection-indicator.component.scss',
})
export class ConnectionIndicatorComponent {
  @Input({ required: true }) state: ConnectionState = 'disconnected';
  @Input() variant: 'default' | 'header' = 'default';

  get sseLabel(): string {
    switch (this.state) {
      case 'connected':
        return 'SSE conectado';
      case 'reconnecting':
        return 'SSE reconectando…';
      default:
        return 'SSE desconectado';
    }
  }

  get operationalLabel(): string {
    switch (this.state) {
      case 'connected':
        return 'Stream ativo';
      case 'reconnecting':
        return 'Reconectando stream';
      default:
        return 'Stream pausado';
    }
  }

  get ariaLabel(): string {
    return `${this.sseLabel}. ${this.operationalLabel}`;
  }
}
