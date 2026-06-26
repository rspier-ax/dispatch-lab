import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  Courier,
  DeliveryEventPayload,
  DemoInfo,
  DemoScenario,
  ScenarioApplyResult,
} from '../../services/dispatch/types';
import { DemoActionKind, DemoActionPreview } from '../../lib/demo-action.types';
import { timelineDisplay, formatTime } from '../../lib/dispatch-view.utils';
import {
  COMING_SOON_TOOLTIP,
  DEMO_CONTROLS_TOOLTIP,
  DemoMapPrefs,
  SEEK_TOOLTIP,
} from '../../lib/demo.constants';
import {
  DemoPanelTab,
  demoNextScriptLabel,
  demoProgressPercent,
  demoScenarios,
  demoSimulationTimeLabel,
  eventTypeBadge,
  filterDemoEvents,
  groupEventsByRecency,
  toActionPreviewFromReset,
  toActionPreviewFromScenario,
} from '../../lib/demo.utils';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import { DemoActionConfirmComponent } from './demo-action-confirm.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-demo-center-panel',
  standalone: true,
  imports: [DemoActionConfirmComponent],
  templateUrl: './demo-center-panel.component.html',
  styleUrl: './demo-center-panel.component.scss',
})
export class DemoCenterPanelComponent implements OnChanges {
  @Input() open = false;
  @Input({ required: true }) demoInfo: DemoInfo | null = null;
  @Input() tick = 0;
  @Input() events: DeliveryEventPayload[] = [];
  @Input() couriers: Courier[] = [];
  @Input() selectedCourierId: string | null = null;
  @Input() mapPrefs: DemoMapPrefs = {
    showBoundsOverlay: false,
    showRoutePolyline: true,
    highlightCourierId: null,
  };

  @Output() closed = new EventEmitter<void>();
  @Output() focusCourier = new EventEmitter<string>();
  @Output() applyScenario = new EventEmitter<ScenarioApplyResult>();
  @Output() mapPrefsChange = new EventEmitter<DemoMapPrefs>();
  @Output() refreshed = new EventEmitter<void>();

  readonly comingSoon = COMING_SOON_TOOLTIP;
  readonly demoControlsHint = DEMO_CONTROLS_TOOLTIP;
  readonly seekHint = SEEK_TOOLTIP;
  readonly tabs: { id: DemoPanelTab; label: string }[] = [
    { id: 'control', label: 'Controle' },
    { id: 'scenarios', label: 'Cenários' },
    { id: 'events', label: 'Eventos' },
  ];

  activeTab: DemoPanelTab = 'control';
  focusCourierId = '';
  selectedScenarioId: string | null = null;
  appliedScenarioId: string | null = null;
  eventCourierFilter: string | null = null;
  confirmOpen = false;
  confirmPreview: DemoActionPreview | null = null;
  confirmAction: DemoActionKind | null = null;
  confirmScenarioId: string | null = null;
  applying = false;

  constructor(private readonly provider: HttpDispatchProvider) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && this.scenarios.length) {
      if (!this.selectedScenarioId) {
        this.selectedScenarioId = this.scenarios[0].id;
      }
      if (!this.appliedScenarioId) {
        this.appliedScenarioId = this.scenarios[0].id;
      }
    }
    if (changes['selectedCourierId'] && this.selectedCourierId) {
      this.focusCourierId = this.selectedCourierId;
      this.syncHighlightCourier();
    }
    if (changes['couriers'] && !this.focusCourierId && this.couriers.length) {
      this.focusCourierId = this.couriers[0].id;
      this.syncHighlightCourier();
    }
  }

  get scenarios(): DemoScenario[] {
    return demoScenarios(this.demoInfo);
  }

  get controlsEnabled(): boolean {
    return this.demoInfo?.controls_enabled ?? false;
  }

  get hasPendingScenarioChange(): boolean {
    return (
      !!this.selectedScenarioId &&
      !!this.appliedScenarioId &&
      this.selectedScenarioId !== this.appliedScenarioId
    );
  }

  get footerBusy(): boolean {
    return this.applying;
  }

  get nextScriptLabel(): string {
    return demoNextScriptLabel(this.demoInfo, this.tick);
  }

  get progressPercent(): number {
    return demoProgressPercent(this.tick);
  }

  get simulationTimeLabel(): string {
    return demoSimulationTimeLabel(this.tick, this.demoInfo?.interval_ms);
  }

  filteredEvents(): DeliveryEventPayload[] {
    return filterDemoEvents(this.events, this.eventCourierFilter);
  }

  eventGroups(): { label: string; items: DeliveryEventPayload[] }[] {
    return groupEventsByRecency(this.filteredEvents());
  }

  eventTitle(ev: DeliveryEventPayload): string {
    return timelineDisplay({
      id: '',
      courier_id: ev.courier_id,
      type: ev.type,
      message: ev.message,
      timestamp: ev.timestamp,
    }).title;
  }

  eventBadge = eventTypeBadge;
  formatTime = formatTime;

  setTab(tab: DemoPanelTab): void {
    this.activeTab = tab;
  }

  onClose(): void {
    this.closed.emit();
  }

  onFocusChange(id: string): void {
    this.focusCourierId = id;
    this.focusCourier.emit(id);
    this.syncHighlightCourier();
  }

  selectScenario(scenario: DemoScenario): void {
    this.selectedScenarioId = scenario.id;
  }

  async onApplyScenario(): Promise<void> {
    if (!this.hasPendingScenarioChange || !this.selectedScenarioId || this.applying) return;
    const scenario = this.scenarios.find((s) => s.id === this.selectedScenarioId);
    if (!scenario) return;

    try {
      this.applying = true;
      const preview = await firstValueFrom(
        this.provider.demoPreviewScenario(
          scenario.id,
          scenario.id === 'random_stale' ? undefined : this.focusCourierId || undefined,
        ),
      );
      this.confirmAction = 'apply_scenario';
      this.confirmScenarioId = scenario.id;
      this.confirmPreview = toActionPreviewFromScenario(preview, scenario.title);
      this.confirmOpen = true;
    } finally {
      this.applying = false;
    }
  }

  async onResetDemo(): Promise<void> {
    if (!this.controlsEnabled || this.applying) return;

    try {
      this.applying = true;
      const preview = await firstValueFrom(this.provider.demoPreviewReset());
      this.confirmAction = 'reset';
      this.confirmScenarioId = null;
      this.confirmPreview = toActionPreviewFromReset(preview);
      this.confirmOpen = true;
    } finally {
      this.applying = false;
    }
  }

  onConfirmCancelled(): void {
    if (this.applying) return;
    this.closeConfirm();
  }

  async onConfirmAccepted(): Promise<void> {
    if (!this.confirmPreview?.can_apply || !this.confirmAction || this.applying) return;

    try {
      this.applying = true;
      if (this.confirmAction === 'reset') {
        await firstValueFrom(this.provider.demoReset());
        this.refreshed.emit();
        const defaultScenarioId = this.scenarios[0]?.id ?? null;
        this.appliedScenarioId = defaultScenarioId;
        this.selectedScenarioId = defaultScenarioId;
      } else if (this.confirmAction === 'apply_scenario' && this.confirmScenarioId) {
        const result = await firstValueFrom(
          this.provider.demoApplyScenario(this.confirmScenarioId, {
            courierId:
              this.confirmScenarioId === 'random_stale'
                ? undefined
                : this.focusCourierId || undefined,
            confirmReset: this.confirmPreview.requires_reset ?? false,
          }),
        );
        this.appliedScenarioId = this.confirmScenarioId;
        if (result.reset_performed) {
          this.refreshed.emit();
        }
        this.applyScenario.emit(result);
      }
      this.closeConfirm();
    } finally {
      this.applying = false;
    }
  }

  toggleMapPref(key: 'showBoundsOverlay' | 'showRoutePolyline', value: boolean): void {
    this.mapPrefsChange.emit({ ...this.mapPrefs, [key]: value });
  }

  async onTriggerStale(): Promise<void> {
    if (!this.controlsEnabled || !this.focusCourierId) return;
    await firstValueFrom(this.provider.demoTrigger(this.focusCourierId, 'go_stale'));
  }

  async onTriggerReconnect(): Promise<void> {
    if (!this.controlsEnabled || !this.focusCourierId) return;
    await firstValueFrom(this.provider.demoTrigger(this.focusCourierId, 'reconnect'));
  }

  private closeConfirm(): void {
    this.confirmOpen = false;
    this.confirmPreview = null;
    this.confirmAction = null;
    this.confirmScenarioId = null;
  }

  private syncHighlightCourier(): void {
    const id = this.focusCourierId || null;
    if (this.mapPrefs.highlightCourierId === id) return;
    this.mapPrefsChange.emit({ ...this.mapPrefs, highlightCourierId: id });
  }
}
