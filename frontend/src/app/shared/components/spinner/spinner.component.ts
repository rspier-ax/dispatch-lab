import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `<span class="app-spinner" [class.app-spinner--md]="size === 'md'" aria-hidden="true"></span>`,
  styles: [
    `
      .app-spinner {
        display: inline-block;
        width: 0.875rem;
        height: 0.875rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: app-spinner-spin 0.65s linear infinite;
        flex-shrink: 0;
      }

      .app-spinner--md {
        width: 1rem;
        height: 1rem;
      }

      @keyframes app-spinner-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .app-spinner {
          animation: none;
          border-right-color: currentColor;
          opacity: 0.55;
        }
      }
    `,
  ],
})
export class SpinnerComponent {
  @Input() size: 'sm' | 'md' = 'sm';
}
