import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SnackbarHostComponent } from './shared/components/snackbar-host/snackbar-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SnackbarHostComponent],
  template: `
    <router-outlet />
    <app-snackbar-host />
  `,
  styles: [`:host { display: block; min-height: 100vh; }`],
})
export class AppComponent {}
