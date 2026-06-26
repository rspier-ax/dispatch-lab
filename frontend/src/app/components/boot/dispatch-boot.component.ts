import { Component, Input } from '@angular/core';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-dispatch-boot',
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: './dispatch-boot.component.html',
  styleUrl: './dispatch-boot.component.scss',
})
export class DispatchBootComponent {
  @Input() message = 'Carregando operação…';
}
