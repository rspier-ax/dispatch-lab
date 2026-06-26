import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'app-snackbar-host',
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: './snackbar-host.component.html',
  styleUrl: './snackbar-host.component.scss',
})
export class SnackbarHostComponent {
  readonly toast = inject(ToastService);

  dismiss(id: string): void {
    this.toast.dismiss(id);
  }
}
