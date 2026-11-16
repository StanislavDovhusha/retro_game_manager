import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AddGameResponse, RenameGameResponse, SettingsPatch } from '@shared/api';
import type { PlanMode, SearchGame, SyncReportOk } from '@shared/models';
import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService, type ToastKind } from '../../core/services/toast.service';
import { LibraryStore } from '../../core/state/library.store';
import { LogStore } from '../../core/state/log.store';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { DialogStateService } from '../dialogs/dialog-state.service';
import { DonateService } from '../donate/donate.service';
import { GameSearchService } from '../search/game-search.service';
import type { LibraryPaths } from './library.models';
import { LibraryViewService } from './library-view.service';

/** The toast suffix telling which image the game file was built from. */
const ADDED_IMAGE_TOASTS: Record<Exclude<PlanMode, 'single'>, string> = {
  disc: 'toasts.gameAddedDisc',
  clonecd: 'toasts.gameAddedCloneCd',
  ecm: 'toasts.gameAddedEcm',
};

/** Operations on the library (scan, delete, rename, image, platform choice…) and the notifications about them. */
@Injectable({ providedIn: 'root' })
export class GameActionsService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly libraryStore = inject(LibraryStore);
  private readonly view = inject(LibraryViewService);
  private readonly log = inject(LogStore);
  private readonly dialogs = inject(DialogStateService);
  private readonly donate = inject(DonateService);
  private readonly search = inject(GameSearchService);

  /** A delete operation is running. */
  readonly busy = signal(false);
  /** A CSV sync is running (set by the sync dialog). */
  readonly syncing = signal(false);
  /** Any long operation is running: the scan, a sync or a delete. */
  readonly working = computed(() => this.busy() || this.libraryStore.scanning() || this.syncing());

  fail(e: unknown): void {
    this.toasts.push('error', toErrorMessage(e));
  }

  private notify(text: string, kind: ToastKind = 'success'): void {
    this.toasts.push(kind, text);
  }

  async reload() {
    const library = await this.libraryStore.refresh();
    this.log.touch();
    return library;
  }

  async scan(): Promise<void> {
    const library = await this.reload();
    if (library?.gamesDir.exists) {
      const count = library.counts.games;
      this.notify(this.i18n.t('toasts.scanFound', { count, noun: this.i18n.plural('plural.game', count) }));
    }
  }

  /** Saves the settings draft, resets the selection and rescans the library. */
  async saveSettings(draft: SettingsPatch): Promise<void> {
    await this.settingsStore.save(draft);
    this.view.selectedRel.set(null);
    this.view.selectedDir.set(null);
    await this.reload();
    this.notify(this.i18n.t('toasts.settingsSaved'));
  }

  async saveLibraryPaths(paths: LibraryPaths): Promise<void> {
    await this.saveSettings(paths);
    this.view.clearChecked();
  }

  /** The SD card root is only remembered; paths change when a platform is chosen. */
  async pickSdRoot(): Promise<void> {
    try {
      const picked = await firstValueFrom(this.api.pickFolder());
      if (!picked.path) return;
      const response = await firstValueFrom(this.api.setSdRoot(picked.path));
      await this.settingsStore.reload();
      this.notify(this.i18n.t('toasts.sdRootSelected', { count: response.platforms.length }));
      if (response.detected?.changed) this.notify(this.i18n.t('toasts.deviceDetected', { name: response.detected.device.name }), 'info');
    } catch (e) { this.fail(e); }
  }

  /**
   * On start: the server checks that the saved card is still there (exists, can be read and written; it gives up after
   * a few seconds). When it is not, the server has forgotten the card, its platform and paths: the start screen with
   * the tips comes back, the selection (and the Details panel), the search and its index are cleared, and a notice
   * asks to choose the card again. A failed check changes nothing.
   */
  async verifySavedCard(languageReady: Promise<unknown> = Promise.resolve()): Promise<void> {
    if (!this.settingsStore.settings()?.sdRoot) return;
    let response;
    try {
      response = await firstValueFrom(this.api.verifySdRoot());
    } catch {
      return; // the card is then checked by the scan as before
    }
    if (!response.reset) return;
    this.settingsStore.replace(response.settings);
    this.view.resetSelection({ query: true });
    this.search.reset();
    this.log.touch();
    await languageReady.catch(() => undefined); // the notice in the saved language, not the one of the first render
    const text = this.i18n.t('toasts.sdRootUnavailable') + (response.reset.systemDenied ? this.i18n.t('toasts.sdRootMacAccess') : '');
    this.notify(text, response.reset.systemDenied ? 'error' : 'info');
  }

  /**
   * Platform choice: the server fills in the games folder, images folder and CSV; everything is reread and the selection
   * is reset (the search field too, unless `keepQuery`). Resolves to false when the platform could not be chosen.
   */
  async selectPlatform(name: string, options: { keepQuery?: boolean } = {}): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.api.selectPlatform(name));
      this.view.resetSelection({ query: !options.keepQuery });
      await this.settingsStore.reload();
      await this.reload();
      this.notify(this.i18n.t('toasts.platformSelected', { name: response.platform.name }));
      return true;
    } catch (e) {
      this.fail(e);
      await this.settingsStore.reload().catch(() => { /* the settings stay as they were */ });
      return false;
    }
  }

  /**
   * "All platforms" (the breadcrumbs, Backspace or Esc): the platform is no longer chosen, the main screen shows the
   * platform list of the card again, and the folder tree loses its selection (it is the same setting). The search
   * text stays. Resolves to false when it failed.
   */
  async clearPlatform(): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.api.clearPlatform());
      this.view.resetSelection();
      this.settingsStore.replace(response.settings);
      await this.reload();
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  /**
   * Opens a game found by the global search: its platform folder is chosen (when another one is open) and the game is
   * selected in the table. The query stays, so the other results remain at hand; the filter is widened to all fields
   * and the folder selection is dropped, so the game is surely in the list.
   */
  async revealGame(game: Pick<SearchGame, 'platform' | 'rel'>): Promise<void> {
    const current = this.settingsStore.settings()?.platform ?? '';
    if (game.platform && game.platform !== current && !(await this.selectPlatform(game.platform, { keepQuery: true }))) return;
    this.view.scope.set('all');
    this.view.selectedDir.set(null);
    // The index can be newer than the table (a game copied to the card meanwhile): the table is read again first.
    if (!this.view.library()?.files.some((file) => file.rel === game.rel)) await this.reload();
    this.view.selectedRel.set(game.rel);
  }

  /** After adding: refresh the list and show the new game (the filter is cleared so that it is visible). */
  async handleAdded(result: AddGameResponse): Promise<void> {
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(key, params);
    const name = result.rel.split('/').pop() ?? result.rel;
    this.notify(
      t('toasts.gameAdded', { title: result.title })
      + (result.compressed ? t('toasts.gameAddedZip', { name }) : result.mode === 'single' ? '' : t(ADDED_IMAGE_TOASTS[result.mode], { name }))
      + (result.imageName ? t(result.imageGenerated ? 'toasts.gameAddedGeneratedCover' : 'toasts.gameAddedImage') : '')
      + (result.csv.mode === 'updated' ? t('toasts.gameAddedCsvUpdated') : ''),
    );
    result.warnings.forEach((warning) => this.notify(warning, 'info'));
    result.listErrors?.forEach((error) => this.notify(error, 'error'));
    if (result.extensionsChanged) await this.settingsStore.reload().catch(() => { /* .img or .zip was added to the extension list */ });
    this.view.query.set('');
    this.view.selectedDir.set(null);
    await this.reload();
    this.view.selectedRel.set(result.rel);
    // Counted only when everything is done: the support popup then waits for the operations to end (see the dialog host).
    await this.donate.registerActions(1);
  }

  async handleSyncDone(report: SyncReportOk): Promise<void> {
    this.notify(this.i18n.t('toasts.syncDone', { added: report.toAdd, removed: report.toRemove }));
    if (report.created) this.notify(this.i18n.t('toasts.syncCsvCreated'));
    if (report.tagsColumnAdded) this.notify(this.i18n.t('toasts.syncTagsColumn', { count: report.tagsColumnAdded }));
    await this.settingsStore.reload().catch(() => { /* the sync status is refreshed on the next load */ });
    await this.reload();
  }

  async handleRenamed(result: RenameGameResponse): Promise<void> {
    this.notify(this.i18n.t('toasts.gameRenamed', { title: result.title }));
    result.warnings.forEach((warning) => this.notify(warning, 'info'));
    result.listErrors?.forEach((error) => this.notify(error, 'error'));
    await this.reload();
    this.view.selectedRel.set(result.newRel);
    await this.donate.registerActions(1);
  }

  /** Confirmed deletion of the selected game file or its image. */
  async deleteSelected(removeFromCsv: boolean): Promise<void> {
    const request = this.dialogs.deleteRequest();
    if (!request) return;
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(key, params);
    const { kind, game } = request;
    try {
      this.busy.set(true);
      if (kind === 'game') {
        const response = await firstValueFrom(this.api.deleteGame(game.rel, removeFromCsv));
        response.listErrors?.forEach((error) => this.notify(error, 'error'));
        this.notify(
          t('toasts.fileDeleted', { fileName: game.fileName })
          + (response.csv.updated ? t('toasts.fileDeletedCsv') : response.csv.reason && removeFromCsv ? t('toasts.fileDeletedCsvNotChanged', { reason: response.csv.reason }) : ''),
        );
      } else {
        const response = await firstValueFrom(this.api.deleteImage(game.rel));
        this.notify(response.deleted ? t('toasts.imageDeleted') : t('toasts.imageUnlinked'));
      }
      this.dialogs.deleteRequest.set(null);
      await this.reload();
      if (kind === 'game') await this.donate.registerActions(1); // removing only the image is not an action with the game
    } catch (e) {
      this.fail(e);
      this.dialogs.deleteRequest.set(null);
      await this.reload();
    } finally {
      this.busy.set(false);
    }
  }

  /** Confirmed deletion of all checked games. */
  async deleteChecked(removeFromCsv: boolean): Promise<void> {
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(key, params);
    try {
      this.busy.set(true);
      const response = await firstValueFrom(this.api.deleteGames([...this.view.checked()], removeFromCsv));
      response.listErrors?.forEach((error) => this.notify(error, 'error'));
      const parts = [t('toasts.gamesDeleted', { count: response.deleted.length })];
      if (response.missing.length) parts.push(t('toasts.alreadyMissing', { count: response.missing.length }));
      if (response.csv.updated) parts.push(t('toasts.csvEntriesRemoved', { count: response.csv.removed }));
      else if (removeFromCsv && response.csv.reason) parts.push(t('toasts.csvNotChanged', { reason: response.csv.reason }));
      const first = response.failed[0];
      if (first) {
        this.notify(t('toasts.deleteFailed', { summary: parts.join(', '), count: response.failed.length, rel: first.rel, error: first.error }), 'error');
        this.view.checked.set(new Set(response.failed.map((failure) => failure.rel))); // games that were not deleted stay checked
      } else {
        this.notify(parts.join(', '));
        this.view.clearChecked();
      }
      this.dialogs.deleteMany.set(false);
      await this.reload();
      // The whole batch at once, after it has finished: every deleted game counts, the popup comes at most once.
      await this.donate.registerActions(response.deleted.length);
    } catch (e) {
      this.fail(e);
      this.dialogs.deleteMany.set(false);
      await this.reload();
    } finally {
      this.busy.set(false);
    }
  }

  /** Lets the user pick an image file for the selected game. */
  async chooseImage(): Promise<void> {
    const game = this.view.selected();
    if (!game) return;
    try {
      const picked = await firstValueFrom(this.api.pickFile('image'));
      if (!picked.path) return;
      await firstValueFrom(this.api.setImage(game.rel, picked.path));
      this.notify(this.i18n.t('toasts.imageSelected'));
      await this.reload();
    } catch (e) { this.fail(e); }
  }
}
