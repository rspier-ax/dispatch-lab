import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Courier, DeliveryEventPayload, DemoInfo, DemoScenario } from '../../services/dispatch/types';
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
} from '../../lib/demo.utils';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-demo-center-panel',
  standalone: true,
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
  @Output() applyScenario = new EventEmitter<DemoScenario>();
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
  highlightEnabled = true;
  eventCourierFilter: string | null = null;

  constructor(private readonly provider: HttpDispatchProvider) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && !this.selectedScenarioId && this.scenarios.length) {
      this.selectedScenarioId = this.scenarios[0].id;
    }
    if (changes['mapPrefs']) {
      this.highlightEnabled = !!this.mapPrefs.highlightCourierId;
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

  get nextScriptLabel(): string {
    return demoNextScriptLabel(this.demoInfo, this.tick);
  }

  get progressPercent(): number {
    return demoProgressPercent(this.tick);
  }

  get simulationTimeLabel(): string {
    return demoSimulationTimeLabel(this.tick, this.demoInfo?.interval_ms);
  }

  get highlightLabel(): string {
    return this.focusCourierId ? `Destacar ${this.focusCourierId}` : 'Destacar entregador';
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

  onApplyScenario(): void {
    const scenario =
      this.scenarios.find((s) => s.id === this.selectedScenarioId) ?? this.scenarios[0];
    if (!scenario) return;
    this.applyScenario.emit(scenario);
  }

  toggleMapPref(key: 'showBoundsOverlay' | 'showRoutePolyline', value: boolean): void {
    this.mapPrefsChange.emit({ ...this.mapPrefs, [key]: value });
  }

  onHighlightToggle(enabled: boolean): void {
    this.highlightEnabled = enabled;
    this.syncHighlightCourier();
  }

  async onResetDemo(): Promise<void> {
    if (!this.controlsEnabled) return;
    await firstValueFrom(this.provider.demoReset());
    this.refreshed.emit();
  }

  async onTriggerStale(): Promise<void> {
    if (!this.controlsEnabled || !this.focusCourierId) return;
    await firstValueFrom(this.provider.demoTrigger(this.focusCourierId, 'go_stale'));
  }

  async onTriggerReconnect(): Promise<void> {
    if (!this.controlsEnabled || !this.focusCourierId) return;
    await firstValueFrom(this.provider.demoTrigger(this.focusCourierId, 'reconnect'));
  }

  private syncHighlightCourier(): void {
    const id = this.highlightEnabled && this.focusCourierId ? this.focusCourierId : null;
    if (this.mapPrefs.highlightCourierId === id) return;
    this.mapPrefsChange.emit({ ...this.mapPrefs, highlightCourierId: id });
  }
}
