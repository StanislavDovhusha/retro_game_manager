import { t } from '../i18n/index.ts';
import type { CsvTable, ImagesDirInfo, ScanResult, Settings, SyncPlan, SyncPreviewResponse, SyncReportOk } from '../models/index.ts';
import { BadRequestError, ConflictError } from '../utils/errors.ts';
import { errorMessage } from '../utils/guards.ts';
import { runExclusive } from '../utils/lock.ts';
import { assertDirectory, safeResolve, statOrNull } from '../utils/paths.ts';
import { listsLocation, updateConsoleLists } from './consoleLists.ts';
import { applyPlan, buildPlan, csvLookup } from './csv/plan.ts';
import { readCsv, writeCsv } from './csv/store.ts';
import { resolveImagesDir } from './fs/imageIndex.ts';
import { scanGames } from './fs/scanner.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { getSettings, patchInternal } from './settingsService.ts';
import { assertNotMediaFolder, csvReadOptions } from './deviceService.ts';

export interface PreparedSync {
  settings: Settings;
  csv: CsvTable;
  scan: ScanResult;
  plan: SyncPlan;
  imagesDir: ImagesDirInfo | null;
}

interface SyncSummary {
  toAdd: number;
  toRemove: number;
  unchanged: number;
  unmanaged: number;
  duplicates: number;
  created: boolean;
  tagsColumnAdded: number;
}

/** Reads the CSV, scans the games folder and builds the sync plan (nothing is changed). */
export async function prepareSync(): Promise<PreparedSync> {
  const settings = await getSettings();
  if (!settings.gamesDir) throw new BadRequestError(t('Choose the games folder first'));
  assertNotMediaFolder(settings);
  await assertDirectory(settings.gamesDir, t('Games folder'));
  if (!settings.csvPath) throw new BadRequestError(t('Choose the CSV file in the settings first'));

  const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
  const imagesDir = await resolveImagesDir(settings);
  const scan = await scanGames(settings.gamesDir, settings.extensions, imagesDir ? [imagesDir.path] : []);
  const [firstError] = scan.errors;
  if (firstError) {
    // When part of the folders could not be read, "the file is missing" cannot be told from "could not read it".
    throw new ConflictError(
      t('Some folders cannot be read, sync stopped: {path} — {message}', { path: firstError.path, message: firstError.message }),
    );
  }
  const plan = await buildPlan({
    csv,
    columns: settings.csv.columns,
    prefix: settings.csv.pathPrefix,
    files: scan.files,
    fileExists: async (rel) => {
      try {
        return Boolean(await statOrNull(safeResolve(settings.gamesDir, rel)));
      } catch {
        return false;
      }
    },
  });
  return { settings, csv, scan, plan, imagesDir };
}

const summary = (plan: SyncPlan): SyncSummary => ({
  toAdd: plan.toAdd.length,
  toRemove: plan.stale.length,
  unchanged: plan.unchanged,
  unmanaged: plan.unmanaged,
  duplicates: plan.duplicates,
  created: plan.created,
  tagsColumnAdded: plan.tagsColumnAdded,
});

/** A preliminary report: neither the CSV nor the files are changed. */
export async function previewSync(): Promise<SyncPreviewResponse> {
  const { plan } = await prepareSync();
  return { ...summary(plan), added: plan.toAdd, removed: plan.stale.map((entry) => entry.path) };
}

/** Runs the sync. The plan is rebuilt from the state of the disk at the moment of the call. */
export function applySync(): Promise<SyncReportOk> {
  return runExclusive(t('CSV sync'), async () => {
    journal('info', t('CSV sync: started'));
    try {
      const { settings, csv, plan, scan } = await prepareSync();
      const counts = summary(plan);
      let backupPath: string | null = null;
      let synced: CsvTable = csv;

      // A missing (or empty) CSV is created even when the folder has no games; rows without the tags column get it.
      if (counts.toAdd || counts.toRemove || counts.created || counts.tagsColumnAdded) {
        const next = applyPlan(csv, plan, { prefix: settings.csv.pathPrefix, addTagsColumn: true });
        backupPath = await writeCsv(settings.csvPath, next);
        synced = next;
        if (counts.created) journal('info', t('The CSV file was created: {csvPath}', { csvPath: settings.csvPath }));
        if (counts.tagsColumnAdded) {
          journal('info', t('The tags column was added to {count} CSV row(s)', { count: counts.tagsColumnAdded }));
        }
      }

      // The console's lists follow the files of the platform: allfiles.lst gets the missing games and loses the lines
      // of games that are gone; favorites and recent games only lose those lines.
      let lists: SyncReportOk['lists'] = null;
      const location = listsLocation(settings);
      if (location) {
        const lookup = csvLookup(synced, settings.csv.columns, settings.csv.pathPrefix);
        const games = scan.files.map((file) => {
          const entry = lookup.get(file.rel.toLowerCase());
          return { platform: location.platform, rel: file.rel, title: entry?.name || file.name, short: entry?.short ?? '' };
        });
        const result = await updateConsoleLists(settings, { kind: 'sync', platform: location.platform, games, add: true });
        lists = {
          added: result.edits.reduce((sum, edit) => sum + edit.added, 0),
          removed: result.edits.reduce((sum, edit) => sum + edit.removed, 0),
          updated: result.edits.reduce((sum, edit) => sum + edit.updated, 0),
          warnings: result.warnings,
          errors: result.errors,
        };
      }

      const report: SyncReportOk = { ...counts, backupPath, lists, at: Date.now(), ok: true };
      await patchInternal((s) => {
        s.lastSync = report;
      });
      invalidateScan();
      journal(
        'success',
        t('Sync finished: added {toAdd}, removed {toRemove}, unchanged {unchanged}', {
          toAdd: counts.toAdd,
          toRemove: counts.toRemove,
          unchanged: counts.unchanged,
        }) + (backupPath ? t('; backup: {backupPath}', { backupPath }) : t('; the CSV was not changed')),
      );
      return report;
    } catch (err) {
      journal('error', t('Sync failed: {message}', { message: errorMessage(err) }));
      await patchInternal((s) => {
        s.lastSync = { ok: false, at: Date.now(), error: errorMessage(err) };
      }).catch(() => undefined);
      throw err;
    }
  });
}
