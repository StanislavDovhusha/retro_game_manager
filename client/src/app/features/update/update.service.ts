import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { UpdateRelease, UpdateStatusResponse } from '@shared/api';
import { ApiService } from '../../core/api/api.service';
import { SettingsStore } from '../../core/state/settings.store';

/** The result of "Check now", shown in the settings. */
export type ManualCheck = 'checking' | 'latest' | 'available' | 'failed';

/**
 * A newer version of the application. On start the server is asked in the background (it asks GitHub at most once a
 * day, with a timeout; nothing waits for it). A newer release shows the notice at the top of the window until it is
 * closed; a closed version stays closed until a newer one comes out. Failures are only logged by the server.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly api = inject(ApiService);
  private readonly settingsStore = inject(SettingsStore);

  readonly status = signal<UpdateStatusResponse | null>(null);
  /** The notice was closed in this session. */
  private readonly closed = signal(false);
  /** "Check now" found a release: its notice is shown even when that version was closed before. */
  private readonly forced = signal(false);
  readonly manual = signal<ManualCheck | null>(null);

  /** The release the notice at the top shows, or null. */
  readonly banner = computed<UpdateRelease | null>(() => {
    const status = this.status();
    if (!status?.available || this.closed()) return null;
    return status.dismissed && !this.forced() ? null : status.available;
  });

  private started = false;

  constructor() {
    // Once the settings are loaded (the interface is up), in the background.
    effect(() => {
      if (!this.settingsStore.settings() || this.started) return;
      this.started = true;
      untracked(() => void this.load());
    });
  }

  private async load(): Promise<void> {
    try {
      this.status.set(await firstValueFrom(this.api.updateStatus()));
    } catch {
      // No server answer: nothing to show (the server logs its own failures).
    }
  }

  /** "Check now" in the settings: at once, and the result is shown there (and the notice, when there is a release). */
  async checkNow(): Promise<void> {
    this.manual.set('checking');
    try {
      const status = await firstValueFrom(this.api.checkUpdates());
      this.status.set(status);
      if (status.check === 'failed') this.manual.set('failed');
      else if (status.available) {
        this.closed.set(false);
        this.forced.set(true);
        this.manual.set('available');
      } else this.manual.set('latest');
    } catch {
      this.manual.set('failed');
    }
  }

  /** The cross of the notice: this version is not announced again. */
  dismiss(): void {
    const version = this.banner()?.version;
    this.closed.set(true);
    this.forced.set(false);
    if (!version) return;
    void this.settingsStore.save({ updates: { dismissedVersion: version } }).catch(() => {
      // Not saved: the notice simply shows again at the next start.
    });
  }
}
