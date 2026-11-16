import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PublicSettings } from '@shared/models';
import { ApiService } from '../../../core/api/api.service';
import { DeviceStore } from '../../../core/state/device.store';
import { toErrorMessage } from '../../../shared/utils/error.utils';
import { GameActionsService } from '../../library/game-actions.service';
import type { LibraryPaths } from '../../library/library.models';

/** `<folder>/<name>` with the same separator the user uses (Windows or Unix). */
export function joinPath(base: string, name: string): string {
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  return `${base.replace(/[\\/]+$/, '')}${separator}${name}`;
}

/** State and logic of the "Folders and CSV file" dialog. */
@Injectable()
export class LibraryPathsService {
  private readonly api = inject(ApiService);
  private readonly actions = inject(GameActionsService);
  private readonly devices = inject(DeviceStore);

  readonly paths = signal<LibraryPaths>({ gamesDir: '', imagesDir: '', csvPath: '' });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  start(settings: PublicSettings): void {
    this.paths.set({ gamesDir: settings.gamesDir, imagesDir: settings.imagesDir, csvPath: settings.csvPath });
  }

  patch(patch: Partial<LibraryPaths>): void {
    this.paths.update((paths) => ({ ...paths, ...patch }));
  }

  /**
   * When the games folder changes, the other paths are generated automatically (they can be edited by hand): the covers
   * folder and the game list named as on the chosen console (`images`, `filelist.csv`).
   */
  setGamesDir(gamesDir: string): void {
    const device = this.devices.active();
    const covers = device?.covers.folder ?? 'images';
    const list = device?.csv.fileName ?? 'filelist.csv';
    this.paths.set(gamesDir.trim()
      ? { gamesDir, imagesDir: joinPath(gamesDir, covers), csvPath: joinPath(gamesDir, list) }
      : { gamesDir, imagesDir: '', csvPath: '' });
  }

  async pickFolder(target: 'games' | 'images'): Promise<void> {
    this.error.set(null);
    try {
      const picked = await firstValueFrom(this.api.pickFolder());
      if (!picked.path) return;
      if (target === 'games') this.setGamesDir(picked.path);
      else this.patch({ imagesDir: picked.path });
    } catch (e) { this.error.set(toErrorMessage(e)); }
  }

  async pickCsv(): Promise<void> {
    this.error.set(null);
    try {
      const picked = await firstValueFrom(this.api.pickFile('csv'));
      if (picked.path) this.patch({ csvPath: picked.path });
    } catch (e) { this.error.set(toErrorMessage(e)); }
  }

  /** Saves the paths; true when the dialog can be closed. */
  async save(): Promise<boolean> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const { gamesDir, imagesDir, csvPath } = this.paths();
      await this.actions.saveLibraryPaths({ gamesDir: gamesDir.trim(), imagesDir: imagesDir.trim(), csvPath: csvPath.trim() });
      return true;
    } catch (e) {
      this.error.set(toErrorMessage(e));
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}
