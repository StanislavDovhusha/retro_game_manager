import { Injectable, inject, signal } from '@angular/core';
import type { PublicSettings } from '@shared/models';
import { ToastService } from '../../core/services/toast.service';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { DEFAULT_SHARE, clampShare } from './split.logic';

/**
 * The layout of the side panels. The left column is one panel, "Folders", with the "All games" panel under it:
 * a tab between them opens and closes "All games", a splitter changes how the height is shared. The right panel
 * ("Details") can be hidden. Everything is applied at once and saved to the settings with a delay.
 */
@Injectable({ providedIn: 'root' })
export class PanelLayoutService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly toasts = inject(ToastService);
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** "All games" is open (the tab is pressed). */
  readonly gamesOpen = signal(true);
  /** The part of the free height of the left column that the Folders block takes (0.1 … 0.9). */
  readonly foldersShare = signal(DEFAULT_SHARE);
  readonly rightHidden = signal(false);

  /** Applies the saved state. The settings keep one "hidden" flag per panel: `games` means "All games" is closed. */
  restore(ui: PublicSettings['ui']): void {
    this.gamesOpen.set(!ui.hiddenPanels.games);
    this.foldersShare.set(clampShare(ui.foldersShare));
    this.rightHidden.set(Boolean(ui.hiddenPanels.right));
  }

  toggleGames(): void {
    this.gamesOpen.update((open) => !open);
    this.scheduleSave();
  }

  /** The splitter is being moved: the layout follows, nothing is saved yet. */
  moveSplit(share: number): void {
    this.foldersShare.set(clampShare(share));
  }

  /** The splitter was released (or moved with the keyboard): the height is saved. */
  commitSplit(): void {
    this.scheduleSave();
  }

  resetSplit(): void {
    this.foldersShare.set(DEFAULT_SHARE);
    this.scheduleSave();
  }

  toggleRight(): void {
    this.rightHidden.update((hidden) => !hidden);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    const ui = {
      // `left` is not used any more (the left column cannot be hidden); it stays false.
      hiddenPanels: { left: false, games: !this.gamesOpen(), right: this.rightHidden() },
      foldersShare: this.foldersShare(),
    };
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.settingsStore.save({ ui }).catch((e: unknown) => this.toasts.push('error', toErrorMessage(e)));
    }, 300);
  }
}
