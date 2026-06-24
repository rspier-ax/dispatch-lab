import { Routes } from '@angular/router';
import { DispatchPageComponent } from './features/dispatch/dispatch-page.component';

export const routes: Routes = [
  { path: '', component: DispatchPageComponent },
  { path: '**', redirectTo: '' },
];
