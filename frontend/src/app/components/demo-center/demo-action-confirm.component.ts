import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DemoActionPreview } from '../../lib/demo-action.types';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-demo-action-confirm',
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: './demo-action-confirm.component.html',
  styleUrl: './demo-action-confirm.component.scss',
})
export class DemoActionConfirmComponent {
  @Input({ required: true }) preview!: DemoActionPreview;
  @Input() applying = false;

  @Output() cancelled = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  get confirmButtonLabel(): string {
    return this.applying ? this.preview.applying_label : this.preview.confirm_label;
  }
}
