import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Library } from '@shared/models';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { ApiService } from '../api/api.service';

/** Scan result of the games folder (the library) and the scan state. */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly api = inject(ApiService);
  private current: Promise<Library | null> | null = null;
  private queued: Promise<Library | null> | null = null;
  private started = false;

  readonly library = signal<Library | null>(null);
  readonly scanning = signal(false);
  readonly error = signal<string | null>(null);

  /** First scan, then a refresh whenever the app window regains focus (no restart needed). */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.refresh();
    window.addEventListener('focus', () => { void this.refresh(); });
  }

  /**
   * Rereads the library. A call that arrives while a scan is running does not start a second one at once: it waits
   * for the running scan and then scans again (calls made in the meantime share that one extra scan), so the caller
   * always gets data that is at least as fresh as its call.
   */
  refresh(): Promise<Library | null> {
    if (!this.current) return this.scan();
    this.queued ??= this.current.then(() => {
      this.queued = null;
      return this.scan();
    });
    return this.queued;
  }

  private scan(): Promise<Library | null> {
    const run = this.load().finally(() => { this.current = null; });
    this.current = run;
    return run;
  }

  private async load(): Promise<Library | null> {
    this.scanning.set(true);
    try {
      const library = await firstValueFrom(this.api.getLibrary());
      this.library.set(library);
      this.error.set(null);
      return library;
    } catch (e) {
      this.error.set(toErrorMessage(e));
      return null;
    } finally {
      this.scanning.set(false);
    }
  }
}
