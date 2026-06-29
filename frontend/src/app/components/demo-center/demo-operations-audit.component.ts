import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Courier, PlatformFeedItem } from '../../services/dispatch/types';
import { formatEta, formatTime } from '../../lib/dispatch-view.utils';
import {
  DemoScenarioLockState,
  PlatformFeedKindFilter,
  QueuedDeliveryRow,
  ScheduleRow,
  filterPlatformFeed,
  partitionScheduleRows,
  platformFeedDeliveryId,
  platformFeedKindLabel,
  platformFeedMessage,
  platformFeedTitle,
  scheduleStatusLabel,
} from '../../lib/demo.utils';

@Component({
  selector: 'app-demo-operations-audit',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './demo-operations-audit.component.html',
  styleUrl: './demo-operations-audit.component.scss',
})
export class DemoOperationsAuditComponent {
  @Input({ required: true }) scheduleRows: ScheduleRow[] = [];
  @Input({ required: true }) queuedRows: QueuedDeliveryRow[] = [];
  @Input({ required: true }) platformFeed: PlatformFeedItem[] = [];
  @Input({ required: true }) couriers: Courier[] = [];
  @Input() tick = 0;
  @Input() elapsedLabel = '';
  @Input() scenarioLock: DemoScenarioLockState = {
    locked: false,
    reason: '',
    remainingEvents: 0,
    activeTitle: '',
    activeId: '',
  };

  @Output() focusCourier = new EventEmitter<string>();

  eventCourierFilter: string | null = null;
  kindFilter: PlatformFeedKindFilter = 'all';
  doneAgendaExpanded = false;

  readonly kindFilters: { value: PlatformFeedKindFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'signal', label: 'Sinal' },
    { value: 'network', label: 'Rede' },
    { value: 'tracking', label: 'Tracking' },
    { value: 'route', label: 'Rota' },
  ];

  scheduleStatusLabel = scheduleStatusLabel;
  formatTime = formatTime;
  formatEta = formatEta;
  feedTitle = platformFeedTitle;
  feedMessage = platformFeedMessage;
  feedDeliveryId = platformFeedDeliveryId;
  feedKindLabel = platformFeedKindLabel;

  get partitionedSchedule() {
    return partitionScheduleRows(this.scheduleRows);
  }

  get upcomingCount(): number {
    return this.partitionedSchedule.upcoming.length;
  }

  get filteredFeed(): PlatformFeedItem[] {
    return filterPlatformFeed(this.platformFeed, this.eventCourierFilter, this.kindFilter);
  }

  get scenarioKpiLabel(): string {
    if (this.scenarioLock.locked) {
      return this.scenarioLock.activeTitle;
    }
    return 'Operação ao vivo';
  }

  scrollToAgenda(): void {
    // no-op: full audit uses single-column scroll on .audit-stack
  }

  onFocusCourier(courierId: string): void {
    this.focusCourier.emit(courierId);
  }

  setKindFilter(kind: PlatformFeedKindFilter): void {
    this.kindFilter = kind;
  }

  clearFilters(): void {
    this.eventCourierFilter = null;
    this.kindFilter = 'all';
  }

  toggleDoneAgenda(): void {
    this.doneAgendaExpanded = !this.doneAgendaExpanded;
  }

  feedTrackKey(item: PlatformFeedItem): string {
    return `${item.kind}-${item.courier_id}-${item.timestamp}-${item.kind === 'delivery_event' ? item.type : item.tracking_state}`;
  }
}
