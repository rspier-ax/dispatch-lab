import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { CourierDetail } from '../../services/dispatch/types';
import {
  formatDistanceM,
  formatDetailEta,
  formatSignalAge,
  formatTime,
  journeySteps,
  remainingDistanceM,
  staleAgeSeconds,
  timelineDisplay,
  trackingStateLabel,
} from '../../lib/dispatch-view.utils';

@Component({
  selector: 'app-courier-detail',
  standalone: true,
  templateUrl: './courier-detail.component.html',
  styleUrl: './courier-detail.component.scss',
})
export class CourierDetailComponent implements OnInit, OnDestroy, OnChanges {
  @Input() detail: CourierDetail | null = null;
  @Input() reconnectNotice = false;
  @Output() closed = new EventEmitter<void>();

  signalAge = '';
  distanceLabel = '';
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timer = setInterval(() => this.refreshDerived(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  ngOnChanges(): void {
    this.refreshDerived();
  }

  trackingLabel = trackingStateLabel;
  formatDetailEta = formatDetailEta;
  formatTime = formatTime;
  timelineDisplay = timelineDisplay;
  journeySteps = journeySteps;

  deliveryStatus(): string | undefined {
    if (!this.detail) return undefined;
    if (this.detail.delivery?.status) return this.detail.delivery.status;
    if (this.detail.timeline.some((e) => e.type === 'delivered')) return 'delivered';
    return undefined;
  }

  private refreshDerived(): void {
    if (!this.detail) {
      this.signalAge = '';
      this.distanceLabel = '';
      return;
    }
    const age = staleAgeSeconds(this.detail.courier.last_seen_at);
    this.signalAge = formatSignalAge(age);
    const dist = remainingDistanceM(this.detail.courier);
    this.distanceLabel = formatDistanceM(dist);
  }
}
