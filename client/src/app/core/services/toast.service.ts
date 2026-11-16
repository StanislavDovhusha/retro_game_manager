import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  /** `text` is already translated. Errors stay longer on screen. */
  push(kind: ToastKind, text: string): void {
    this.seq += 1;
    const id = this.seq;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 8000 : 4000);
  }
}
