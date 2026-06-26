import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
  DEMO_CONTROLS_TOOLTIP,
  DemoMapPrefs,
} from '../../lib/demo.constants';
import {
  DemoPanelTab,
  demoElapsedLabel,
  demoScenarios,
  demoSessionStatusLabel,
  eventTypeBadge,
  filterDemoEvents,
  groupEventsByRecency,
  toActionPreviewFromReset,
  toActionPreviewFromScenario,
} from '../../lib/demo.utils';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import { DemoActionConfirmComponent } from './demo-action-confirm.component';
import { firstValueFrom } from 'rxjs';

const INSTANT_SCENARIOS = new Set(['explore_routes', 'tracking_states', 'queue_focus']);

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
  @Input() refreshDemo!: () => Promise<void>;
  @Input() reloadDemoInfo!: () => Promise<void>;

  @Output() closed = new EventEmitter<void>();
  @Output() applyScenario = new EventEmitter<ScenarioApplyResult>();
  @Output() mapPrefsChange = new EventEmitter<DemoMapPrefs>();

  readonly demoControlsHint = DEMO_CONTROLS_TOOLTIP;
  readonly tabs: { id: DemoPanelTab; label: string }[] = [
    { id: 'control', label: 'Controle' },
    { id: 'scenarios', label: 'Cenários' },
    { id: 'events', label: 'Eventos' },
  ];

  activeTab: DemoPanelTab = 'control';
  eventCourierFilter: string | null = null;
  confirmOpen = false;
  confirmPreview: DemoActionPreview | null = null;
  confirmAction: DemoActionKind | null = null;
  confirmScenarioId: string | null = null;
  applying = false;
  scenarioFeedback: string | null = null;
  runningScenarioId: string | null = null;

  constructor(private readonly provider: HttpDispatchProvider) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === false) {
      this.scenarioFeedback = null;
    }
  }

  get scenarios(): DemoScenario[] {
    return demoScenarios(this.demoInfo);
  }

  get controlsEnabled(): boolean {
    return this.demoInfo?.controls_enabled ?? false;
  }

  get footerBusy(): boolean {
    return this.applying;
  }

  get elapsedLabel(): string {
    return demoElapsedLabel(this.tick, this.demoInfo?.interval_ms);
  }

  get sessionStatusLabel(): string {
    return demoSessionStatusLabel(this.demoInfo, this.tick);
  }

  get selectedCourier(): Courier | undefined {
    if (!this.selectedCourierId) return undefined;
    return this.couriers.find((c) => c.id === this.selectedCourierId);
  }

  get canForceStale(): boolean {
    return this.controlsEnabled && this.selectedCourier?.tracking_state === 'live';
  }

  get canReconnect(): boolean {
    return this.controlsEnabled && this.selectedCourier?.tracking_state === 'stale';
  }

  get staleButtonTitle(): string {
    if (!this.controlsEnabled) return this.demoControlsHint;
    if (!this.selectedCourierId) return 'Selecione um entregador no mapa ou na lista.';
    if (this.selectedCourier?.tracking_state === 'stale') {
      return 'Entregador já está com sinal atrasado.';
    }
    if (this.selectedCourier?.tracking_state === 'offline') {
      return 'Entregador sem sinal — use Reconectar após simular perda.';
    }
    return 'Forçar sinal atrasado no entregador selecionado.';
  }

  get reconnectButtonTitle(): string {
    if (!this.controlsEnabled) return this.demoControlsHint;
    if (!this.selectedCourierId) return 'Selecione um entregador no mapa ou na lista.';
    if (this.selectedCourier?.tracking_state === 'live') {
      return 'Entregador já está ao vivo.';
    }
    return 'Reconectar entregador selecionado.';
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

  isScenarioRunning(id: string): boolean {
    return this.runningScenarioId === id;
  }

  async runScenario(scenario: DemoScenario): Promise<void> {
    if (this.applying || this.runningScenarioId) return;

    if (INSTANT_SCENARIOS.has(scenario.id)) {
      await this.executeScenario(scenario.id, false);
      return;
    }

    try {
      this.applying = true;
      const preview = await firstValueFrom(this.provider.demoPreviewScenario(scenario.id));
      if (!preview.can_apply) {
        this.scenarioFeedback = preview.block_reason ?? 'Cenário indisponível.';
        return;
      }
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
        if (this.refreshDemo) {
          await this.refreshDemo();
        }
        this.scenarioFeedback = null;
      } else if (this.confirmAction === 'apply_scenario' && this.confirmScenarioId) {
        await this.executeScenario(
          this.confirmScenarioId,
          this.confirmPreview.requires_reset ?? false,
        );
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
    if (!this.canForceStale || !this.selectedCourierId) return;
    await firstValueFrom(this.provider.demoTrigger(this.selectedCourierId, 'go_stale'));
  }

  async onTriggerReconnect(): Promise<void> {
    if (!this.canReconnect || !this.selectedCourierId) return;
    await firstValueFrom(this.provider.demoTrigger(this.selectedCourierId, 'reconnect'));
  }

  private async executeScenario(scenarioId: string, confirmReset: boolean): Promise<void> {
    try {
      this.runningScenarioId = scenarioId;
      const result = await firstValueFrom(
        this.provider.demoApplyScenario(scenarioId, { confirmReset }),
      );
      if (result.reset_performed && this.refreshDemo) {
        await this.refreshDemo();
      } else if (this.reloadDemoInfo) {
        await this.reloadDemoInfo();
      }
      if (result.open_control_tab) {
        this.activeTab = 'control';
      }
      this.scenarioFeedback = result.ui_hint ?? 'Cenário aplicado.';
      this.applyScenario.emit(result);
    } catch {
      this.scenarioFeedback = 'Não foi possível executar o cenário.';
    } finally {
      this.runningScenarioId = null;
    }
  }

  private closeConfirm(): void {
    this.confirmOpen = false;
    this.confirmPreview = null;
    this.confirmAction = null;
    this.confirmScenarioId = null;
  }
}
