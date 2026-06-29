import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Courier, Delivery, DemoInfo, PlatformFeedItem, ScriptAction } from '../../services/dispatch/types';
import {
  DemoScenarioLockState,
  QueuedDeliveryRow,
  ScheduleRow,
  buildQueuedDeliveryRows,
  buildScheduleRows,
  demoElapsedLabel,
  demoScenarioLock,
} from '../../lib/demo.utils';
import { DemoOperationsAuditComponent } from './demo-operations-audit.component';

@Component({
  selector: 'app-demo-operations-audit-shell',
  standalone: true,
  imports: [DemoOperationsAuditComponent],
  templateUrl: './demo-operations-audit-shell.component.html',
  styleUrl: './demo-operations-audit-shell.component.scss',
})
export class DemoOperationsAuditShellComponent {
  @Input() open = false;
  @Input({ required: true }) demoInfo: DemoInfo | null = null;
  @Input() tick = 0;
  @Input() platformFeed: PlatformFeedItem[] = [];
  @Input() upcomingScripts: ScriptAction[] = [];
  @Input() tickIntervalMs = 1000;
  @Input() deliveries: Delivery[] = [];
  @Input() couriers: Courier[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() focusCourier = new EventEmitter<string>();

  get elapsedLabel(): string {
    return demoElapsedLabel(this.tick, this.demoInfo?.interval_ms);
  }

  get scenarioLock(): DemoScenarioLockState {
    return demoScenarioLock(this.demoInfo, this.tick, this.upcomingScripts);
  }

  get scheduleRows(): ScheduleRow[] {
    const scripts = this.demoInfo?.scripts?.length ? this.demoInfo.scripts : this.upcomingScripts;
    return buildScheduleRows(scripts, this.tick, this.tickIntervalMs);
  }

  get queuedRows(): QueuedDeliveryRow[] {
    return buildQueuedDeliveryRows(this.deliveries, this.couriers);
  }

  onClose(): void {
    this.closed.emit();
  }

  onFocusCourier(courierId: string): void {
    this.focusCourier.emit(courierId);
  }
}
