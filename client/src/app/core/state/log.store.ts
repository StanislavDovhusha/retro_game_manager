import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { LogEntry } from '@shared/models';
import { ApiService } from '../api/api.service';

/** Operation log: the entries from the server and whether the log panel is open. */
@Injectable({ providedIn: 'root' })
export class LogStore {
  private readonly api = inject(ApiService);

  readonly open = signal(false);
  readonly entries = signal<LogEntry[]>([]);
  /** Changes after every operation: an open log panel reloads the entries. */
  readonly refreshKey = signal(0);

  toggle(): void {
    this.open.update((value) => !value);
    this.touch();
  }

  close(): void {
    this.open.set(false);
  }

  touch(): void {
    this.refreshKey.update((key) => key + 1);
  }

  async load(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getLog());
      this.entries.set(response.entries);
    } catch { /* the log is optional */ }
  }
}
