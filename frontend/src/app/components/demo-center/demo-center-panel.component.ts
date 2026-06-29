import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  Courier,
  Delivery,
  DemoInfo,
  DemoScenario,
  PlatformFeedItem,
  ScenarioApplyResult,
  ScriptAction,
} from '../../services/dispatch/types';
import { DemoActionKind, DemoActionPreview } from '../../lib/demo-action.types';
import {
  DEMO_CONTROLS_TOOLTIP,
  DemoMapPrefs,
  DEMO_RESET_MIN_MS,
} from '../../lib/demo.constants';
import { LOADING_LABELS } from '../../lib/loading-labels';
import {
  DemoPanelTab,
  buildQueuedDeliveryRows,
  buildScheduleRows,
  demoElapsedLabel,
  demoScenarioLock,
  demoScenarioModeBanner,
  demoScenarios,
  demoSessionStatusLabel,
  isScenarioBlocked,
  toActionPreviewFromReset,
  toActionPreviewFromScenario,
} from '../../lib/demo.utils';
import { HttpDispatchProvider } from '../../services/dispatch/http-dispatch.provider';
import { ToastService } from '../../core/ui/toast.service';
import { DemoActionConfirmComponent } from './demo-action-confirm.component';
import { DemoEventsSummaryComponent } from './demo-events-summary.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { firstValueFrom } from 'rxjs';

const INSTANT_SCENARIOS = new Set(['explore_routes', 'tracking_states', 'queue_focus']);

@Component({
  selector: 'app-demo-center-panel',
  standalone: true,
  imports: [DemoActionConfirmComponent, DemoEventsSummaryComponent, SpinnerComponent],
  templateUrl: './demo-center-panel.component.html',
  styleUrl: './demo-center-panel.component.scss',
})
export class DemoCenterPanelComponent implements OnChanges {
  @Input() open = false;
  @Input({ required: true }) demoInfo: DemoInfo | null = null;
  @Input() tick = 0;
  @Input() platformFeed: PlatformFeedItem[] = [];
  @Input() upcomingScripts: ScriptAction[] = [];
  @Input() tickIntervalMs = 1000;
  @Input() deliveries: Delivery[] = [];
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
  @Output() focusCourier = new EventEmitter<string>();
  @Output() openFullAudit = new EventEmitter<void>();
  @Output() mapPrefsChange = new EventEmitter<DemoMapPrefs>();

  readonly demoControlsHint = DEMO_CONTROLS_TOOLTIP;
  readonly LOADING_LABELS = LOADING_LABELS;
  readonly tabs: { id: DemoPanelTab; label: string }[] = [
    { id: 'control', label: 'Controle' },
    { id: 'scenarios', label: 'Cenários' },
    { id: 'events', label: 'Eventos' },
  ];

  activeTab: DemoPanelTab = 'control';
  confirmOpen = false;
  confirmPreview: DemoActionPreview | null = null;
  confirmAction: DemoActionKind | null = null;
  confirmScenarioId: string | null = null;
  applying = false;
  scenarioBlockFeedback: string | null = null;
  runningScenarioId: string | null = null;
  triggeringAction: 'go_stale' | 'reconnect' | null = null;
  scenarioCooldownUntil = 0;

  private readonly provider = inject(HttpDispatchProvider);
  private readonly toast = inject(ToastService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === false) {
      this.scenarioBlockFeedback = null;
    }
  }

  get scenarios(): DemoScenario[] {
    return demoScenarios(this.demoInfo);
  }

  get controlsEnabled(): boolean {
    return this.demoInfo?.controls_enabled ?? false;
  }

  get footerBusy(): boolean {
    return this.applying || !!this.runningScenarioId || !!this.triggeringAction;
  }

  get elapsedLabel(): string {
    return demoElapsedLabel(this.tick, this.demoInfo?.interval_ms);
  }

  get sessionStatusLabel(): string {
    return demoSessionStatusLabel(this.demoInfo, this.tick, this.upcomingScripts);
  }

  get hasScheduledEvents(): boolean {
    const pending =
      this.upcomingScripts.length > 0
        ? this.upcomingScripts.filter((s) => s.tick > this.tick).length
        : (this.demoInfo?.scripts?.filter((s) => s.tick > this.tick).length ?? 0);
    return pending > 0;
  }

  get scenarioLock() {
    return demoScenarioLock(this.demoInfo, this.tick, this.upcomingScripts);
  }

  get scenarioModeBanner() {
    return demoScenarioModeBanner(this.scenarioLock);
  }

  get scheduleRows() {
    const scripts = this.demoInfo?.scripts?.length ? this.demoInfo.scripts : this.upcomingScripts;
    return buildScheduleRows(scripts, this.tick, this.tickIntervalMs);
  }

  get queuedRows() {
    return buildQueuedDeliveryRows(this.deliveries, this.couriers);
  }

  get selectedCourier(): Courier | undefined {
    if (!this.selectedCourierId) return undefined;
    return this.couriers.find((c) => c.id === this.selectedCourierId);
  }

  get canForceStale(): boolean {
    return (
      this.controlsEnabled &&
      this.selectedCourier?.tracking_state === 'live' &&
      !this.triggeringAction &&
      !this.scenarioLock.locked
    );
  }

  get canReconnect(): boolean {
    return (
      this.controlsEnabled &&
      this.selectedCourier?.tracking_state === 'stale' &&
      !this.triggeringAction &&
      !this.scenarioLock.locked
    );
  }

  get staleButtonTitle(): string {
    if (this.scenarioLock.locked) {
      return this.scenarioLock.reason;
    }
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
    if (this.scenarioLock.locked) {
      return this.scenarioLock.reason;
    }
    if (!this.controlsEnabled) return this.demoControlsHint;
    if (!this.selectedCourierId) return 'Selecione um entregador no mapa ou na lista.';
    if (this.selectedCourier?.tracking_state === 'live') {
      return 'Entregador já está ao vivo.';
    }
    return 'Reconectar entregador selecionado.';
  }

  setTab(tab: DemoPanelTab): void {
    this.activeTab = tab;
  }

  onStatusStripClick(): void {
    if (!this.hasScheduledEvents) return;
    this.activeTab = 'events';
  }

  onOpenFullAudit(): void {
    this.openFullAudit.emit();
  }

  onFocusCourier(courierId: string): void {
    this.focusCourier.emit(courierId);
  }

  onClose(): void {
    this.closed.emit();
  }

  isScenarioRunning(id: string): boolean {
    return this.runningScenarioId === id;
  }

  isTriggering(action: 'go_stale' | 'reconnect'): boolean {
    return this.triggeringAction === action;
  }

  isScenarioCooldownActive(): boolean {
    return Date.now() < this.scenarioCooldownUntil;
  }

  isScenarioRunDisabled(scenario: DemoScenario): boolean {
    if (this.footerBusy || this.isScenarioRunning(scenario.id)) {
      return true;
    }
    if (this.isScenarioCooldownActive()) {
      return true;
    }
    return isScenarioBlocked(scenario.id, this.scenarioLock);
  }

  isScenarioRunLocked(scenario: DemoScenario): boolean {
    return isScenarioBlocked(scenario.id, this.scenarioLock);
  }

  scenarioRunTitle(scenario: DemoScenario): string {
    if (isScenarioBlocked(scenario.id, this.scenarioLock)) {
      return this.scenarioLock.reason;
    }
    if (this.isScenarioCooldownActive()) {
      return 'Aguarde a conclusão da aplicação do cenário anterior.';
    }
    return '';
  }

  async runScenario(scenario: DemoScenario): Promise<void> {
    if (this.applying || this.runningScenarioId || this.isScenarioCooldownActive()) {
      return;
    }
    if (isScenarioBlocked(scenario.id, this.scenarioLock)) {
      this.toast.info(this.scenarioLock.reason);
      return;
    }

    if (INSTANT_SCENARIOS.has(scenario.id)) {
      await this.executeScenario(scenario.id, false);
      return;
    }

    try {
      this.applying = true;
      const preview = await firstValueFrom(this.provider.demoPreviewScenario(scenario.id));
      if (!preview.can_apply) {
        const reason = preview.block_reason ?? 'Cenário indisponível.';
        this.scenarioBlockFeedback = reason;
        this.toast.info(reason);
        return;
      }
      this.scenarioBlockFeedback = null;
      this.confirmAction = 'apply_scenario';
      this.confirmScenarioId = scenario.id;
      this.confirmPreview = toActionPreviewFromScenario(preview, scenario.title);
      this.confirmOpen = true;
    } finally {
      this.applying = false;
    }
  }

  async onResetDemo(): Promise<void> {
    if (!this.controlsEnabled || this.applying || this.runningScenarioId) return;

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

    const toastId =
      this.confirmAction === 'reset' ? 'demo-reset' : `scenario-${this.confirmScenarioId}`;

    try {
      this.applying = true;
      this.toast.loading(
        this.confirmAction === 'reset'
          ? LOADING_LABELS.pending.resettingDemo
          : LOADING_LABELS.pending.applyingScenario,
        { id: toastId },
      );

      if (this.confirmAction === 'reset') {
        await firstValueFrom(this.provider.demoReset());
        if (this.refreshDemo) {
          await this.refreshDemo();
        }
        this.scenarioBlockFeedback = null;
        this.toast.success(LOADING_LABELS.success.demoReset, { id: toastId });
      } else if (this.confirmAction === 'apply_scenario' && this.confirmScenarioId) {
        await this.executeScenario(
          this.confirmScenarioId,
          this.confirmPreview.requires_reset ?? false,
          toastId,
        );
      }
      this.closeConfirm();
    } catch {
      this.toast.error(
        this.confirmAction === 'reset'
          ? LOADING_LABELS.error.resetFailed
          : LOADING_LABELS.error.scenarioFailed,
        { id: toastId },
      );
      this.closeConfirm();
    } finally {
      this.applying = false;
    }
  }

  toggleMapPref(key: 'showBoundsOverlay' | 'showRoutePolyline', value: boolean): void {
    this.mapPrefsChange.emit({ ...this.mapPrefs, [key]: value });
  }

  async onTriggerStale(): Promise<void> {
    if (!this.canForceStale || !this.selectedCourierId || this.triggeringAction) return;

    try {
      this.triggeringAction = 'go_stale';
      await firstValueFrom(this.provider.demoTrigger(this.selectedCourierId, 'go_stale'));
      this.toast.success(LOADING_LABELS.success.staleForced);
    } catch {
      this.toast.error(LOADING_LABELS.error.triggerFailed);
    } finally {
      this.triggeringAction = null;
    }
  }

  async onTriggerReconnect(): Promise<void> {
    if (!this.canReconnect || !this.selectedCourierId || this.triggeringAction) return;

    try {
      this.triggeringAction = 'reconnect';
      await firstValueFrom(this.provider.demoTrigger(this.selectedCourierId, 'reconnect'));
      this.toast.success(LOADING_LABELS.success.reconnected);
    } catch {
      this.toast.error(LOADING_LABELS.error.triggerFailed);
    } finally {
      this.triggeringAction = null;
    }
  }

  private async executeScenario(
    scenarioId: string,
    confirmReset: boolean,
    toastId?: string,
  ): Promise<void> {
    const id = toastId ?? `scenario-${scenarioId}`;

    try {
      this.runningScenarioId = scenarioId;
      if (!toastId) {
        this.toast.loading(LOADING_LABELS.pending.applyingScenario, { id });
      }

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
      this.scenarioBlockFeedback = null;
      this.toast.success(result.ui_hint ?? LOADING_LABELS.success.scenarioApplied, { id });
      this.startScenarioCooldown();
      this.applyScenario.emit(result);
    } catch {
      this.toast.error(LOADING_LABELS.error.scenarioFailed, { id });
    } finally {
      this.runningScenarioId = null;
    }
  }

  private startScenarioCooldown(): void {
    this.scenarioCooldownUntil = Date.now() + DEMO_RESET_MIN_MS;
  }

  private closeConfirm(): void {
    this.confirmOpen = false;
    this.confirmPreview = null;
    this.confirmAction = null;
    this.confirmScenarioId = null;
  }
}
