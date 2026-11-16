import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EmulatorStatusResponse } from '@shared/api';
import { ApiService } from '../../core/api/api.service';
import { DesktopService } from '../../core/desktop/desktop.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { LibraryViewService } from '../library/library-view.service';

/** What the Details panel shows for the emulator. */
export interface EmulatorCard {
  /** OpenEmu or RetroArch. */
  name: string;
  installed: boolean;
  downloadUrl: string;
  launchable: boolean;
  /** Why the game cannot be started (shown under the disabled button). */
  reason: string | null;
  /** A secondary remark under the reason (smaller and dimmer), e.g. that support for the format is coming. */
  note: string | null;
  /** The check of the selected game is running. */
  checking: boolean;
  launching: boolean;
}

/**
 * "Play in emulator" (desktop application only): whether the emulator of the computer is installed, whether the
 * selected game can be started in it, and starting it. The server finds the emulator and starts it as a separate
 * process; this service asks again whenever the selected game, the open folder or the emulator setting changes.
 */
@Injectable({ providedIn: 'root' })
export class EmulatorService {
  private readonly api = inject(ApiService);
  private readonly view = inject(LibraryViewService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18nService);

  /** Starting games is offered only in the desktop application. */
  readonly enabled = inject(DesktopService).isDesktop;
  /** The emulator and the check of the selected game. */
  readonly status = signal<EmulatorStatusResponse | null>(null);
  private readonly checking = signal(false);
  private readonly launching = signal(false);
  private sequence = 0;

  /** What the check depends on: the game, the folder it is in, the emulator chosen in the settings. */
  private readonly key = computed(() => {
    const settings = this.settingsStore.settings();
    // The language too: the reasons are written by the server in the interface language (X-Lang).
    return JSON.stringify([this.view.selectedRel(), settings?.gamesDir, settings?.platform, settings?.emulatorPath, this.view.version(), this.i18n.lang()]);
  });

  readonly card = computed<EmulatorCard | null>(() => {
    const status = this.status();
    if (!this.enabled || !status?.enabled) return null;
    return {
      name: status.emulator,
      installed: status.path !== null,
      downloadUrl: status.downloadUrl,
      launchable: status.game?.launchable ?? false,
      reason: status.game?.reason ?? null,
      note: status.game?.note ?? null,
      checking: this.checking(),
      launching: this.launching(),
    };
  });

  constructor() {
    effect(() => {
      this.key();
      untracked(() => {
        if (this.enabled) void this.refresh();
      });
    });
  }

  async refresh(): Promise<void> {
    const sequence = ++this.sequence;
    this.checking.set(true);
    try {
      const status = await firstValueFrom(this.api.emulatorStatus(this.view.selectedRel() ?? undefined));
      if (sequence === this.sequence) this.status.set(status);
    } catch {
      // The card simply shows no emulator line; the next selection asks again.
      if (sequence === this.sequence) this.status.set(null);
    } finally {
      if (sequence === this.sequence) this.checking.set(false);
    }
  }

  /** Starts the selected game. Errors (no emulator, no core, the program failed) are shown as a notification. */
  async launch(): Promise<void> {
    const game = this.view.selected();
    if (!game || this.launching()) return;
    this.launching.set(true);
    try {
      const result = await firstValueFrom(this.api.launchGame(game.rel));
      const emulator = result.core ? `${result.emulator} (${result.core})` : result.emulator;
      this.toasts.push('success', this.i18n.t('toasts.emulatorStarted', { title: game.title, emulator }));
    } catch (e) {
      this.toasts.push('error', toErrorMessage(e));
      void this.refresh(); // the emulator or its core may have gone: the button shows the new state
    } finally {
      this.launching.set(false);
    }
  }
}
