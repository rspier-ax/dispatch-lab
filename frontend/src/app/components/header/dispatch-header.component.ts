import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ConnectionIndicatorComponent } from '../connection/connection-indicator.component';
import { ConnectionState } from '../../services/dispatch/types';
import { CourierMetrics, formatClock } from '../../lib/dispatch-view.utils';

@Component({
  selector: 'app-dispatch-header',
  standalone: true,
  imports: [ConnectionIndicatorComponent],
  templateUrl: './dispatch-header.component.html',
  styleUrl: './dispatch-header.component.scss',
})
export class DispatchHeaderComponent implements OnInit, OnDestroy {
  @Input({ required: true }) metrics!: CourierMetrics;
  @Input({ required: true }) connectionState: ConnectionState = 'disconnected';

  clock = formatClock(new Date());
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.clock = formatClock(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
