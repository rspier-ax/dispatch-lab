import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ScenarioPreview } from '../../services/dispatch/types';

@Component({
  selector: 'app-demo-scenario-confirm',
  standalone: true,
  templateUrl: './demo-scenario-confirm.component.html',
  styleUrl: './demo-scenario-confirm.component.scss',
})
export class DemoScenarioConfirmComponent {
  @Input({ required: true }) preview!: ScenarioPreview;
  @Input() scenarioTitle = '';

  @Output() cancelled = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();
}
