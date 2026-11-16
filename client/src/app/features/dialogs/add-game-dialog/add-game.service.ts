import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { EMPTY, type Subscription, catchError, exhaustMap, firstValueFrom, lastValueFrom, tap, timer } from 'rxjs';
import type { AddGameResponse } from '@shared/api';
import { cleanTitle, hasUnsupportedChars } from '@shared/gameName';
import type { AddPhase, FileKind, SourceRef } from '@shared/models';
import { ApiError } from '../../../core/api/api-error';
import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DeviceStore } from '../../../core/state/device.store';
import { SettingsStore } from '../../../core/state/settings.store';
import type { PickedFile } from '../../../shared/components/drop-zone/drop-zone.component';
import { toErrorMessage } from '../../../shared/utils/error.utils';
import { baseName, fileExt, toCamelCase, toSafeFileName } from '../../../shared/utils/text.utils';
import {
  type Issue, IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, isZipSelection, targetFileName, titleFromFiles, validateGameSet,
} from './add-game.rules';

/** Messages of the stages the server reports while it writes the game file. */
const PHASE_KEYS: Record<AddPhase, string> = {
  copying: 'addGame.progress.copyingFile',
  unpacking: 'addGame.progress.unpacking',
  building: 'addGame.progress.building',
  compressing: 'addGame.progress.compressingFile',
};
/** How often the server is asked about the progress of adding. */
const PROGRESS_POLL_MS = 300;

/** State and logic of the "Add game" dialog: picking files, validation, uploading and adding. */
@Injectable()
export class AddGameService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly devices = inject(DeviceStore);

  private extensions: readonly string[] = [];

  readonly games = signal<PickedFile[]>([]);
  readonly gameWarnings = signal<string[]>([]);
  readonly image = signal<PickedFile | null>(null);
  readonly title = signal('');
  readonly gameError = signal<string | null>(null);
  readonly imageError = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly phase = signal('');
  readonly progress = signal(0);
  readonly previewUrl = signal<string | null>(null);
  /** The user's choice in the "Compress to .zip" checkbox; it is kept in the settings between additions. */
  readonly compressWanted = signal(false);

  private titleTouched = false;
  /** The user typed or pasted into the title field (an empty title is then an error, not a fresh form). */
  private readonly titleEdited = signal(false);
  /** Files that are already uploaded to the server: they are not uploaded again on a retry. */
  private readonly staged = new Map<File, string>();
  private finished = false;

  readonly shortName = computed(() => toCamelCase(this.title()));
  readonly imageBase = computed(() => toSafeFileName(this.title()));
  readonly imageList = computed<PickedFile[]>(() => {
    const image = this.image();
    return image ? [image] : [];
  });
  readonly percent = computed(() => Math.round(this.progress() * 100));
  /** The checkbox is offered for every platform whose emulator reads .zip (all but PlayStation). */
  readonly zipOffered = computed(() => this.devices.canZip(this.settingsStore.settings()?.platform ?? ''));
  /** The selected game file is a .zip already: the checkbox is disabled. */
  readonly alreadyZip = computed(() => isZipSelection(this.games().map((game) => game.name)));
  /** Whether the game is packed into a .zip: what the checkbox shows and what is sent to the server. */
  readonly compress = computed(() => this.zipOffered() && !this.alreadyZip() && this.compressWanted());
  readonly target = computed(() => targetFileName(this.games().map((game) => game.name), this.title(), this.compress()));
  /** "|" separates the fields of the console's game lists: a title cannot contain it. */
  readonly titleHasPipe = computed(() => this.title().includes('|'));
  /**
   * Why the title cannot be used (a dictionary key), or null: characters other than English letters, digits, spaces,
   * hyphens, underscores and brackets, or nothing left after they were removed (the field was touched and is empty).
   */
  readonly titleError = computed<string | null>(() => {
    const title = this.title().trim();
    if (hasUnsupportedChars(title)) return 'validation.latinOnly';
    if (!title && this.titleEdited()) return 'validation.nameRequired';
    return null;
  });
  readonly canAdd = computed(() => this.games().length > 0 && this.title().trim().length > 0 && this.shortName().length > 0 && !this.titleHasPipe() && !this.titleError() && !this.busy());

  constructor() {
    effect((onCleanup) => {
      const image = this.image();
      if (image?.kind !== 'file') {
        this.previewUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(image.file);
      this.previewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });

    // The dialog was closed without adding a game: the temporarily uploaded files are removed.
    inject(DestroyRef).onDestroy(() => {
      if (this.finished) return;
      this.staged.forEach((id) => { firstValueFrom(this.api.discardUpload(id)).catch(() => { /* already removed */ }); });
    });
  }

  /** The game extensions from the settings. */
  start(extensions: readonly string[]): void {
    this.extensions = extensions;
    this.compressWanted.set(this.settingsStore.settings()?.ui.compressZip ?? false);
  }

  /** The "Compress to .zip" checkbox: the choice is saved at once, so the next addition starts with it. */
  setCompress(value: boolean): void {
    this.compressWanted.set(value);
    this.settingsStore.save({ ui: { compressZip: value } }).catch(() => { /* only the remembered choice is lost */ });
  }

  private text(issue: Issue): string {
    return this.i18n.t(issue.key, issue.params);
  }

  private applyGames(list: PickedFile[], warnings: string[] = []): void {
    this.games.set(list);
    this.gameWarnings.set(warnings);
    this.gameError.set(null);
    this.error.set(null);
    const main = titleFromFiles(list.map((game) => game.name));
    // The title comes from the file name (.ccd/.cue of a set), with only the allowed characters (`Pokémon Gold (日本)` →
    // `Pokemon Gold ()`); it may end up empty, then the user types one.
    const fromFile = main === null ? '' : cleanTitle(main);
    if (fromFile && (!this.titleTouched || !this.title().trim())) {
      this.title.set(fromFile);
      this.titleTouched = false;
    }
  }

  clearGames(): void {
    this.games.set([]);
    this.gameWarnings.set([]);
  }

  clearImage(): void {
    this.image.set(null);
  }

  setTitle(value: string): void {
    this.title.set(value);
    this.titleTouched = true;
    this.titleEdited.set(true);
  }

  /** The server checks the file set right after it is chosen in the system dialog. */
  async browseGame(): Promise<void> {
    this.gameError.set(null);
    try {
      const picked = await firstValueFrom(this.api.pickFiles('game'));
      if (!picked.paths.length) return;
      const plan = await firstValueFrom(this.api.inspectGameSet(picked.paths));
      this.applyGames(
        plan.files.map((file, index): PickedFile => ({ kind: 'path', path: picked.paths[index] ?? file.name, name: file.name, size: file.size })),
        plan.warnings,
      );
    } catch (e) { this.gameError.set(toErrorMessage(e)); }
  }

  dropGames(files: File[]): void {
    const issue = validateGameSet(files.map((file) => file.name), this.extensions);
    if (issue) {
      this.gameError.set(this.text(issue));
      return;
    }
    if (files.some((file) => file.size === 0)) {
      this.gameError.set(this.i18n.t('addGame.errors.emptyFile'));
      return;
    }
    this.applyGames(files.map((file): PickedFile => ({ kind: 'file', file, name: file.name, size: file.size })));
  }

  async browseImage(): Promise<void> {
    this.imageError.set(null);
    try {
      const picked = await firstValueFrom(this.api.pickFile('image'));
      if (!picked.path) return;
      const info = await firstValueFrom(this.api.inspectFile('image', picked.path));
      this.image.set({ kind: 'path', path: picked.path, name: baseName(picked.path) || info.fileName, size: info.size });
    } catch (e) { this.imageError.set(toErrorMessage(e)); }
  }

  dropImage(files: File[]): void {
    const file = files[0];
    if (!file) return;
    if (!IMAGE_EXTENSIONS.includes(fileExt(file.name))) { this.imageError.set(this.i18n.t('addGame.errors.imageFormats')); return; }
    if (file.size === 0) { this.imageError.set(this.i18n.t('addGame.errors.emptyImage')); return; }
    if (file.size > MAX_IMAGE_BYTES) { this.imageError.set(this.i18n.t('addGame.errors.imageTooLarge')); return; }
    this.imageError.set(null);
    this.image.set({ kind: 'file', file, name: file.name, size: file.size });
  }

  private async toSource(kind: FileKind, picked: PickedFile, label: string, ratio: [number, number] = [0, 1]): Promise<SourceRef> {
    if (picked.kind === 'path') return { type: 'path', path: picked.path };
    let id = this.staged.get(picked.file);
    if (!id) {
      this.phase.set(label);
      this.progress.set(ratio[0]);
      const last = await lastValueFrom(this.api.uploadFile(kind, picked.file).pipe(
        tap((state) => this.progress.set(ratio[0] + state.ratio * (ratio[1] - ratio[0]))),
      ));
      if (!last.result) throw new ApiError(this.i18n.t('errors.upload', { status: 0 }), 0);
      id = last.result.id;
      this.staged.set(picked.file, id);
    }
    return { type: 'upload', id };
  }

  /**
   * While the server writes the game file (unpacks ECM, builds the .img) its stage and percentage are shown;
   * when the file is written, only the CSV and the cover are left.
   */
  private watchProgress(): Subscription {
    let seen = false;
    return timer(PROGRESS_POLL_MS, PROGRESS_POLL_MS).pipe(
      exhaustMap(() => this.api.addProgress().pipe(catchError(() => EMPTY))),
    ).subscribe(({ progress }) => {
      if (progress) {
        seen = true;
        this.phase.set(this.i18n.t(PHASE_KEYS[progress.phase]));
        this.progress.set(progress.ratio);
      } else if (seen) {
        this.phase.set(this.i18n.t('addGame.progress.finishing'));
        this.progress.set(1);
      }
    });
  }

  /** Uploads the files and adds the game; returns the server response or null when it failed (see `error`). */
  async submit(): Promise<AddGameResponse | null> {
    const games = this.games();
    if (!games.length || !this.canAdd()) return null;
    this.busy.set(true);
    this.error.set(null);
    try {
      const gameSources: SourceRef[] = [];
      for (let index = 0; index < games.length; index += 1) {
        const picked = games[index];
        if (!picked) continue;
        const label = games.length > 1
          ? this.i18n.t('addGame.progress.uploadingFile', { current: index + 1, total: games.length })
          : this.i18n.t('addGame.progress.uploadingGame');
        gameSources.push(await this.toSource('game', picked, label, [index / games.length, (index + 1) / games.length]));
      }
      const image = this.image();
      const imageSource = image ? await this.toSource('image', image, this.i18n.t('addGame.progress.uploadingImage')) : null;
      const kind = this.target()?.kind;
      this.phase.set(this.i18n.t(
        kind === 'zip' ? 'addGame.progress.compressing' : kind === 'file' ? 'addGame.progress.copying' : 'addGame.progress.creatingDisc',
      ));
      this.progress.set(1);
      const watch = this.watchProgress();
      try {
        const result = await firstValueFrom(this.api.addGame({
          game: gameSources, title: this.title(), image: imageSource, compress: this.compress(),
        }));
        this.finished = true;
        return result;
      } finally {
        watch.unsubscribe();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.staged.clear(); // uploaded files expired: they are uploaded again on a retry
      this.error.set(toErrorMessage(e));
      return null;
    } finally {
      this.busy.set(false);
      this.phase.set('');
    }
  }
}
