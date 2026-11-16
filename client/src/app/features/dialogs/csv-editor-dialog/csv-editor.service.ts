import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { MissingPreviewResponse } from '@shared/api';
import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../core/services/toast.service';
import { findDuplicateRows } from '../../../shared/utils/filter.utils';
import { toErrorMessage } from '../../../shared/utils/error.utils';
import type { CsvRow, VisibleCsvRow } from './csv-editor.models';

export const PAGE_SIZE = 200;
const snapshot = (rows: CsvRow[]): string => JSON.stringify(rows.map((row) => row.cells));

/** State and logic of the CSV editor: rows, filter, duplicates, saving and removing entries of missing games. */
@Injectable()
export class CsvEditorService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private rowSequence = 0;

  /** The path column from the settings (the first column is used when it is not set). */
  readonly pathColumn = signal('');
  readonly headers = signal<string[]>([]);
  readonly rows = signal<CsvRow[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly filter = signal('');
  readonly limit = signal(PAGE_SIZE);
  readonly missing = signal<MissingPreviewResponse | null>(null);
  readonly checking = signal(false);
  readonly removing = signal(false);

  private readonly savedSnapshot = signal('');

  readonly keyColumn = computed(() => Math.max(0, this.headers().indexOf(this.pathColumn())));
  readonly keyName = computed(() => this.headers()[this.keyColumn()] ?? this.i18n.t('csvEditor.firstColumn'));
  readonly dirty = computed(() => !this.loading() && snapshot(this.rows()) !== this.savedSnapshot());
  readonly duplicates = computed(() => findDuplicateRows(this.rows().map((row) => row.cells), this.keyColumn()));
  readonly normalizedFilter = computed(() => this.filter().trim().toLowerCase());
  readonly visible = computed<VisibleCsvRow[]>(() => {
    const query = this.normalizedFilter();
    return this.rows()
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !query || row.cells.some((cell) => cell.toLowerCase().includes(query)));
  });
  readonly shown = computed(() => this.visible().slice(0, this.limit()));

  async load(): Promise<void> {
    try {
      const data = await firstValueFrom(this.api.getCsvData());
      const rows = data.rows.map((cells): CsvRow => ({ id: ++this.rowSequence, cells: [...cells] }));
      this.headers.set(data.headers);
      this.rows.set(rows);
      this.savedSnapshot.set(snapshot(rows));
    } catch (e) {
      this.error.set(toErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(value: string): void {
    this.filter.set(value);
    this.limit.set(PAGE_SIZE);
  }

  showMore(): void {
    this.limit.update((limit) => limit + PAGE_SIZE);
  }

  setCell(id: number, column: number, value: string): void {
    this.info.set(null);
    this.rows.update((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const cells = [...row.cells];
      while (cells.length <= column) cells.push('');
      cells[column] = value;
      return { ...row, cells };
    }));
  }

  removeRow(id: number): void {
    this.info.set(null);
    this.rows.update((rows) => rows.filter((row) => row.id !== id));
  }

  addRow(): void {
    this.rows.update((rows) => [...rows, { id: ++this.rowSequence, cells: this.headers().map(() => '') }]);
    this.filter.set('');
    this.limit.set(Number.MAX_SAFE_INTEGER);
  }

  removeDuplicates(): void {
    const duplicates = this.duplicates();
    const count = duplicates.size;
    this.rows.update((rows) => rows.filter((_, index) => !duplicates.has(index)));
    this.info.set(this.i18n.t('csvEditor.duplicatesRemoved', { count }));
  }

  /** Writes the rows to the file; true when saved. */
  async save(): Promise<boolean> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const rows = this.rows();
      await firstValueFrom(this.api.saveCsvData(rows.map((row) => row.cells)));
      this.savedSnapshot.set(snapshot(rows));
      this.info.set(this.i18n.t('csvEditor.saved'));
      this.toasts.push('success', this.i18n.t('csvEditor.savedToast'));
      return true;
    } catch (e) {
      this.error.set(toErrorMessage(e));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Checks every entry for a game file in the games folder. Files are not touched. */
  async checkMissing(): Promise<void> {
    this.checking.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const preview = await firstValueFrom(this.api.previewMissing());
      if (preview.count === 0) {
        this.info.set(this.i18n.t('csvEditor.noMissing'));
        this.toasts.push('info', this.i18n.t('csvEditor.noMissingToast'));
      } else {
        this.missing.set(preview);
      }
    } catch (e) {
      this.error.set(toErrorMessage(e));
    } finally {
      this.checking.set(false);
    }
  }

  /** Removes the entries of the missing games from the file; true when the file changed. */
  async confirmRemoveMissing(): Promise<boolean> {
    const missing = this.missing();
    if (!missing) return false;
    this.removing.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.removeMissing(missing.count));
      this.missing.set(null);
      await this.load(); // show the already updated content of the file
      this.info.set(this.i18n.t('csvEditor.removed', { count: response.removed }));
      this.toasts.push('success', this.i18n.t('csvEditor.removedToast', { count: response.removed }));
      return true;
    } catch (e) {
      this.error.set(toErrorMessage(e));
      this.missing.set(null);
      return false;
    } finally {
      this.removing.set(false);
    }
  }

  closeMissing(): void {
    if (!this.removing()) this.missing.set(null);
  }
}
