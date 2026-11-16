import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SettingsPatch } from '@shared/api';
import type { PublicSettings } from '@shared/models';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { ApiService } from '../api/api.service';

/** Application settings received from the server. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(ApiService);

  readonly settings = signal<PublicSettings | null>(null);
  readonly encodings = signal<readonly string[]>(['utf8']);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const settings = this.settings();
      if (settings) document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    });
  }

  async load(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getSettings());
      this.settings.set(response.settings);
      this.encodings.set(response.encodings);
    } catch (e) {
      this.error.set(toErrorMessage(e));
    }
  }

  async reload(): Promise<void> {
    const response = await firstValueFrom(this.api.getSettings());
    this.settings.set(response.settings);
  }

  async save(patch: SettingsPatch): Promise<PublicSettings> {
    const response = await firstValueFrom(this.api.saveSettings(patch));
    this.settings.set(response.settings);
    return response.settings;
  }

  /** Applies settings that were already received in another server response. */
  replace(settings: PublicSettings): void {
    this.settings.set(settings);
  }
}
