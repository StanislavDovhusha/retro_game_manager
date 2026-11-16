import { t } from '../i18n/index.ts';
import type {
  CsvDataResponse,
  CsvPreviewRequest,
  CsvPreviewResponse,
  CsvSaveResponse,
  MissingApplyResponse,
  MissingPreviewResponse,
} from '../models/index.ts';
import { BadRequestError, ConflictError } from '../utils/errors.ts';
import { runExclusive } from '../utils/lock.ts';
import { applyPlan } from './csv/plan.ts';
import { readCsv, writeCsv } from './csv/store.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { getSettings } from './settingsService.ts';
import { prepareSync } from './syncService.ts';
import { csvReadOptions } from './deviceService.ts';

/** Headers and the first rows of the CSV; the parameters may be overridden to check them before saving. */
export async function previewCsv(override: CsvPreviewRequest = {}, limit = 20): Promise<CsvPreviewResponse> {
  const settings = await getSettings();
  const csvPath = override.csvPath || settings.csvPath;
  if (!csvPath) throw new BadRequestError(t('No CSV file selected'));
  const options = {
    delimiter: override.delimiter ?? settings.csv.delimiter,
    encoding: override.encoding ?? settings.csv.encoding,
    hasHeader: override.hasHeader ?? settings.csv.hasHeader,
  };
  const csv = await readCsv(csvPath, options, { allowMissing: true });
  return { path: csvPath, exists: csv.exists, headers: csv.headers, rows: csv.rows.slice(0, limit), total: csv.rows.length };
}

/** The whole CSV for the editor (by the saved settings). */
export async function getCsvData(): Promise<CsvDataResponse> {
  const settings = await getSettings();
  if (!settings.csvPath) throw new BadRequestError(t('No CSV file selected'));
  const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
  return { path: settings.csvPath, exists: csv.exists, headers: csv.headers, hasHeader: csv.hasHeader, rows: csv.rows };
}

/**
 * Saves the edited rows. The headers, encoding, delimiter and line endings come from the current file; a backup
 * is made before writing.
 */
export function saveCsvData({ rows }: { rows: string[][] }): Promise<CsvSaveResponse> {
  return runExclusive(t('editing the CSV'), async () => {
    const settings = await getSettings();
    if (!settings.csvPath) throw new BadRequestError(t('No CSV file selected'));
    const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
    const backupPath = await writeCsv(settings.csvPath, { ...csv, rows });
    invalidateScan();
    journal('success', t('CSV edited manually: {length} rows (backup: {backupPath})', { length: rows.length, backupPath }));
    return { rows: rows.length, backupPath };
  });
}

/**
 * CSV entries that have no game file. It uses the same plan as the sync (the folder is scanned once; when part of
 * the folders is unreadable the operation stops).
 */
export async function previewMissing(): Promise<MissingPreviewResponse> {
  const { plan, csv } = await prepareSync();
  const managed = plan.unchanged + plan.stale.length;
  return {
    count: plan.stale.length,
    total: csv.rows.length,
    managed,
    all: plan.stale.length > 0 && plan.stale.length === managed,
    paths: plan.stale.map((entry) => entry.path).slice(0, 200),
  };
}

/** Removes from the CSV only the entries of missing games. Files and folders on disk are not touched. */
export function removeMissing({ expected }: { expected: number }): Promise<MissingApplyResponse> {
  return runExclusive(t('cleaning the CSV'), async () => {
    const { settings, csv, plan } = await prepareSync();
    if (!plan.stale.length) return { removed: 0, backupPath: null };
    if (expected !== plan.stale.length) {
      throw new ConflictError(
        t('The folder contents have changed: there are now {length} missing entries instead of {expected}. Run the check again.', {
          length: plan.stale.length,
          expected,
        }),
      );
    }
    const next = applyPlan(csv, { ...plan, toAdd: [] }, { prefix: settings.csv.pathPrefix });
    const backupPath = await writeCsv(settings.csvPath, next);
    invalidateScan();
    journal(
      'success',
      t('CSV cleanup: entries for missing games removed — {length} (backup: {backupPath})', { length: plan.stale.length, backupPath }),
    );
    return { removed: plan.stale.length, backupPath };
  });
}
