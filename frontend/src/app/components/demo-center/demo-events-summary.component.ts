import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlatformFeedItem } from '../../services/dispatch/types';
import { formatTime } from '../../lib/dispatch-view.utils';
import {
  DemoScenarioLockState,
  QueuedDeliveryRow,
  ScheduleRow,
  partitionScheduleRows,
  platformFeedBadge,
  platformFeedTitle,
  recentPlatformFeed,
} from '../../lib/demo.utils';

@Component({
  selector: 'app-demo-events-summary',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './demo-events-summary.component.html',
  styleUrl: './demo-events-summary.component.scss',
})
export class DemoEventsSummaryComponent {
  @Input({ required: true }) scheduleRows: ScheduleRow[] = [];
  @Input({ required: true }) queuedRows: QueuedDeliveryRow[] = [];
  @Input({ required: true }) platformFeed: PlatformFeedItem[] = [];
  @Input() scenarioLock: DemoScenarioLockState = {
    locked: false,
    reason: '',
    remainingEvents: 0,
    activeTitle: '',
    activeId: '',
  };

  @Output() openFullAudit = new EventEmitter<void>();
  @Output() focusCourier = new EventEmitter<string>();

  formatTime = formatTime;
  feedBadge = platformFeedBadge;
  feedTitle = platformFeedTitle;

  get partitionedSchedule() {
    return partitionScheduleRows(this.scheduleRows);
  }

  get nextEvent(): ScheduleRow | null {
    return this.partitionedSchedule.upcoming.find((r) => r.status === 'next') ?? null;
  }

  get upcomingCount(): number {
    return this.partitionedSchedule.upcoming.length;
  }

  get recentFeed(): PlatformFeedItem[] {
    return recentPlatformFeed(this.platformFeed, 5);
  }

  get scenarioLabel(): string {
    return this.scenarioLock.locked ? this.scenarioLock.activeTitle : 'Operação ao vivo';
  }

  onOpenFullAudit(): void {
    this.openFullAudit.emit();
  }

  onFocusCourier(courierId: string): void {
    this.focusCourier.emit(courierId);
  }

  feedTrackKey(item: PlatformFeedItem): string {
    return `${item.kind}-${item.courier_id}-${item.timestamp}`;
  }
}
