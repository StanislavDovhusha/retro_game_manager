import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { canCompressToZip, type DeviceProfile, type DeviceSummary } from '@shared/devices';
import { ApiService } from '../api/api.service';
import { SettingsStore } from './settings.store';

/**
 * The console models (profiles in `devices/` on the server) and the profile of the model chosen in the settings:
 * the names of the platforms, the game list and covers folder names, the start-screen tips. Loaded again whenever
 * the chosen model changes (in the settings, or recognized when a card is chosen).
 */
@Injectable({ providedIn: 'root' })
export class DeviceStore {
  private readonly api = inject(ApiService);
  private readonly settingsStore = inject(SettingsStore);

  readonly devices = signal<DeviceSummary[]>([]);
  readonly active = signal<DeviceProfile | null>(null);

  constructor() {
    effect(() => {
      const id = this.settingsStore.settings()?.device;
      if (!id || id === this.active()?.id) return;
      untracked(() => void this.load());
    });
  }

  private async load(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.devices());
      this.devices.set(response.devices);
      this.active.set(response.active);
    } catch {
      // Without the profile the interface still works: platform names are not shown, the defaults are used.
    }
  }

  /** Whether a game added to this platform folder may be compressed to .zip. */
  canZip(folder: string): boolean {
    return canCompressToZip(this.active(), folder);
  }
}
