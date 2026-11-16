import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CsvPreviewResponse } from '@shared/api';
import { defaultDonate } from '@shared/donate';
import type { PublicSettings } from '@shared/models';
import { ApiService } from '../../../core/api/api.service';
import { toErrorMessage } from '../../../shared/utils/error.utils';
import { GameActionsService } from '../../library/game-actions.service';
import type { CsvColumnName, CsvSettingsPatch } from '../csv-settings-form/csv-settings-form.component';

const PREVIEW_DELAY_MS = 250;

/** Value used until `start()`: input values are not available yet in field initializers. */
const blankSettings = (): PublicSettings => ({
  gamesDir: '', imagesDir: '', csvPath: '', sdRoot: '', platform: '',
  csv: { delimiter: ',', encoding: 'utf8', hasHeader: true, pathPrefix: '', columns: { path: '', name: '', short: '', tags: '' } },
  extensions: [], emulatorPath: '', theme: 'dark', ui: { columnWidths: {}, foldersShare: 0.5, hiddenPanels: { left: false, games: false, right: false }, language: 'en', donate: defaultDonate(), compressZip: false, tourDone: false },
  device: '',
  updates: { checkOnStartup: true, lastCheckAt: 0, latestVersion: '', latestUrl: '', latestName: '', dismissedVersion: '' }, lastSync: null,
});

/** Draft of the settings being edited in the dialog, the CSV preview and saving. */
@Injectable()
export class SettingsDraftService {
  private readonly api = inject(ApiService);
  private readonly actions = inject(GameActionsService);

  private saved = blankSettings();
  readonly draft = signal<PublicSettings>(blankSettings());
  readonly preview = signal<CsvPreviewResponse | null>(null);
  readonly previewError = signal<string | null>(null);
  readonly loadingPreview = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** "Open backups folder": the folder that was opened, or why it could not be. */
  readonly openingBackups = signal(false);
  readonly backupsPath = signal<string | null>(null);
  readonly backupsError = signal<string | null>(null);

  readonly headers = computed(() => this.preview()?.headers ?? []);
  /** The CSV parameters in the draft match the saved settings (so the file can be edited). */
  readonly csvSaved = computed(() => {
    const draft = this.draft();
    const saved = this.saved;
    return draft.csvPath === saved.csvPath && draft.csv.delimiter === saved.csv.delimiter
      && draft.csv.encoding === saved.csv.encoding && draft.csv.hasHeader === saved.csv.hasHeader;
  });

  /** What changed in the CSV reading parameters: the preview is reread by this key. */
  private readonly previewKey = computed(() => {
    const draft = this.draft();
    return JSON.stringify([draft.csvPath, draft.csv.delimiter, draft.csv.encoding, draft.csv.hasHeader]);
  });
  private previewSequence = 0;

  constructor() {
    effect((onCleanup) => {
      this.previewKey();
      const timer = setTimeout(() => { void this.loadPreview(); }, PREVIEW_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  /** The copy is made once when the dialog opens: later changes of the parent do not overwrite the draft. */
  start(settings: PublicSettings): void {
    this.saved = settings;
    this.draft.set(structuredClone(settings));
  }

  async loadPreview(): Promise<void> {
    const draft = this.draft();
    const sequence = ++this.previewSequence;
    if (!draft.csvPath) {
      this.preview.set(null);
      this.previewError.set(null);
      return;
    }
    this.loadingPreview.set(true);
    try {
      const preview = await firstValueFrom(this.api.previewCsv({
        csvPath: draft.csvPath, delimiter: draft.csv.delimiter, encoding: draft.csv.encoding, hasHeader: draft.csv.hasHeader,
      }));
      if (sequence !== this.previewSequence) return;
      this.preview.set(preview);
      this.previewError.set(null);
    } catch (e) {
      if (sequence !== this.previewSequence) return;
      this.preview.set(null);
      this.previewError.set(toErrorMessage(e));
    } finally {
      if (sequence === this.previewSequence) this.loadingPreview.set(false);
    }
  }

  /** The "show the support popup automatically" switch. */
  setDonateAutoShow(autoShow: boolean): void {
    this.draft.update((draft) => ({ ...draft, ui: { ...draft.ui, donate: { ...draft.ui.donate, autoShow } } }));
  }

  /** The console model (a profile id). */
  setDevice(device: string): void {
    this.draft.update((draft) => ({ ...draft, device }));
  }

  /** The "check for updates on startup" switch. */
  setCheckUpdates(checkOnStartup: boolean): void {
    this.draft.update((draft) => ({ ...draft, updates: { ...draft.updates, checkOnStartup } }));
  }

  /** The emulator chosen by hand ('' — found automatically). */
  setEmulatorPath(path: string): void {
    this.draft.update((draft) => ({ ...draft, emulatorPath: path.trim() }));
  }

  /** The system dialog for the emulator: OpenEmu.app on macOS, the RetroArch program elsewhere. */
  async pickEmulator(): Promise<void> {
    try {
      const { path } = await firstValueFrom(this.api.pickFile('emulator'));
      if (path) this.setEmulatorPath(path);
    } catch (e) {
      this.error.set(toErrorMessage(e));
    }
  }

  setExtensions(text: string): void {
    this.draft.update((draft) => ({ ...draft, extensions: text.split(/[,\s]+/).filter(Boolean) }));
  }

  patchCsv(patch: CsvSettingsPatch): void {
    this.draft.update((draft) => ({ ...draft, csv: { ...draft.csv, ...patch } }));
  }

  setColumn(key: CsvColumnName, value: string): void {
    this.draft.update((draft) => ({ ...draft, csv: { ...draft.csv, columns: { ...draft.csv.columns, [key]: value } } }));
  }

  /** The CSV file was changed in the editor. */
  async handleCsvSaved(): Promise<void> {
    await this.loadPreview();
    await this.actions.reload();
  }

  /** Saves the draft; true when the dialog can be closed. */
  async save(): Promise<boolean> {
    this.saving.set(true);
    this.error.set(null);
    try {
      // `ui` is sent only with the switch of this dialog: the draft's copy of the other UI settings (and of the popup counter,
      // which changes while the dialog is open) is older than the saved one and must not overwrite it.
      // The same for `updates`: only the switch; the results of the checks and the closed notice are not the dialog's.
      const { ui, updates, ...draft } = this.draft();
      await this.actions.saveSettings({ ...draft, ui: { donate: { autoShow: ui.donate.autoShow } }, updates: { checkOnStartup: updates.checkOnStartup } });
      return true;
    } catch (e) {
      this.error.set(toErrorMessage(e));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Opens the folder with the backups of the CSV and the cubegm lists (on this computer) in the file manager. */
  async openBackups(): Promise<void> {
    this.openingBackups.set(true);
    this.backupsError.set(null);
    try {
      const { path } = await firstValueFrom(this.api.openBackupsFolder());
      this.backupsPath.set(path);
    } catch (e) {
      this.backupsError.set(toErrorMessage(e));
    } finally {
      this.openingBackups.set(false);
    }
  }
}
