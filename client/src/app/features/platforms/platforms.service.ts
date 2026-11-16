import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { coverPalette, platformName } from '@shared/devices';
import type { PlatformSummary } from '@shared/api';
import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { DeviceStore } from '../../core/state/device.store';
import { LibraryStore } from '../../core/state/library.store';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';
import type { PlatformCardItem } from './platforms.logic';

/**
 * The platform list of the main screen: shown while a card is chosen and no platform is (the platform is the same
 * `settings.platform` the folder tree and the Platform list of the left panel choose). The server counts the games of
 * every platform folder; the list is fetched again whenever it comes on screen and whenever the library is reread
 * while it is on screen (after adding, deleting or syncing, or when the window regains focus).
 */
@Injectable({ providedIn: 'root' })
export class PlatformsService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly devices = inject(DeviceStore);
  private readonly libraryStore = inject(LibraryStore);
  private readonly settingsStore = inject(SettingsStore);

  private readonly summaries = signal<{ root: string; platforms: PlatformSummary[] } | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly root = computed(() => this.settingsStore.settings()?.sdRoot ?? '');
  /** A card without a chosen platform (and without a games folder chosen by hand). */
  readonly visible = computed(() => {
    const settings = this.settingsStore.settings();
    return Boolean(settings?.sdRoot && !settings.platform && !settings.gamesDir);
  });

  /** The cards, in the order of the server (by full name); the texts follow the interface language. */
  readonly items = computed<PlatformCardItem[]>(() => {
    const loaded = this.summaries();
    if (!loaded || loaded.root !== this.root()) return [];
    const device = this.devices.active();
    return loaded.platforms.map((platform) => ({
      name: platform.name,
      label: platform.label,
      games: platform.games,
      countText: this.i18n.t('platforms.count', { count: platform.games, noun: this.i18n.plural('plural.game', platform.games) }),
      palette: coverPalette(device, platform.name),
    }));
  });

  private running: Promise<void> | null = null;
  private again = false;

  constructor() {
    effect(() => {
      const visible = this.visible();
      this.root();
      this.settingsStore.settings()?.device;
      this.libraryStore.library();
      untracked(() => { if (visible) void this.refresh(); });
    });
  }

  /** The full name of a platform folder for the breadcrumbs (the folder name when the profile does not know it). */
  title(folder: string): string {
    return platformName(this.devices.active(), folder) ?? folder;
  }

  /** Fetches the list; a call made while a fetch runs is served by one more fetch after it. */
  refresh(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.loading.set(true);
    this.running = (async () => {
      try {
        this.summaries.set(await firstValueFrom(this.api.sdPlatforms()));
        this.error.set(null);
      } catch (e) {
        this.error.set(toErrorMessage(e));
      } finally {
        this.loading.set(false);
        this.running = null;
      }
      if (this.again) {
        this.again = false;
        await this.refresh();
      }
    })();
    return this.running;
  }
}
