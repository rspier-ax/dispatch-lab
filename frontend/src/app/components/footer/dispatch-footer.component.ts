import { Component, Input } from '@angular/core';
import { ConnectionState } from '../../services/dispatch/types';
import { formatBbox } from '../../lib/dispatch-view.utils';
import { MapBounds } from '../../services/dispatch/types';

@Component({
  selector: 'app-dispatch-footer',
  standalone: true,
  templateUrl: './dispatch-footer.component.html',
  styleUrl: './dispatch-footer.component.scss',
})
export class DispatchFooterComponent {
  @Input({ required: true }) connectionState: ConnectionState = 'disconnected';
  @Input() bounds: MapBounds | null = null;

  readonly version = '1.0.0';

  get bboxLabel(): string {
    if (!this.bounds) return '';
    return formatBbox(this.bounds.min_lng, this.bounds.min_lat, this.bounds.max_lng, this.bounds.max_lat);
  }

  get streamActive(): boolean {
    return this.connectionState === 'connected';
  }
}
