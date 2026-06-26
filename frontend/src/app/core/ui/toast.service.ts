import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'loading';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

export interface ToastOptions {
  id?: string;
  duration?: number;
}

const DEFAULT_SUCCESS_MS = 3200;
const DEFAULT_ERROR_MS = 4500;
const DEFAULT_INFO_MS = 3200;
const DEFAULT_LOADING_MS = 120_000;

let nextId = 0;

function createId(explicit?: string): string {
  return explicit ?? `toast-${++nextId}`;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  success(message: string, options?: ToastOptions): string {
    return this.show(message, 'success', options?.duration ?? DEFAULT_SUCCESS_MS, options?.id);
  }

  error(message: string, options?: ToastOptions): string {
    return this.show(message, 'error', options?.duration ?? DEFAULT_ERROR_MS, options?.id);
  }

  info(message: string, options?: ToastOptions): string {
    return this.show(message, 'info', options?.duration ?? DEFAULT_INFO_MS, options?.id);
  }

  loading(message: string, options?: ToastOptions): string {
    return this.show(message, 'loading', options?.duration ?? DEFAULT_LOADING_MS, options?.id);
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }

  private show(message: string, tone: ToastTone, durationMs: number, explicitId?: string): string {
    const id = createId(explicitId);
    this.clearTimer(id);

    const toast: ToastMessage = { id, message, tone, durationMs };
    this.messages.update((items) => {
      const without = items.filter((item) => item.id !== id);
      return [...without, toast];
    });

    if (tone !== 'loading' && durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
