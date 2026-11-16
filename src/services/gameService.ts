import fs from 'node:fs/promises';
import { t } from '../i18n/index.ts';
import type { CsvRemoval, DeleteGameResponse, DeleteGamesResponse } from '../models/index.ts';
import { BadRequestError, InternalError, NotFoundError, ValidationError } from '../utils/errors.ts';
import { errorCode, errorMessage } from '../utils/guards.ts';
import { runExclusive } from '../utils/lock.ts';
import { assertNotProtected, safeResolveExisting } from '../utils/paths.ts';
import { listsLocation, updateConsoleLists } from './consoleLists.ts';
import { removeEntries } from './csv/plan.ts';
import { listPath } from './lists/listLines.ts';
import { readCsv, writeCsv } from './csv/store.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { getSettings } from './settingsService.ts';
import { csvReadOptions } from './deviceService.ts';

/**
 * Deletes several game files (only inside the games folder) and, in one pass, their CSV entries.
 * A file that is already gone is not an error: its CSV entry is removed too.
 */
export function deleteGames({ rels, removeFromCsv = true }: { rels: string[]; removeFromCsv?: boolean }): Promise<DeleteGamesResponse> {
  return runExclusive(t('deleting games'), async () => {
    if (rels.length === 0) throw new BadRequestError(t('No games selected for deletion'));
    const settings = await getSettings();
    if (!settings.gamesDir) throw new BadRequestError(t('The games folder is not selected'));

    const result: Omit<DeleteGamesResponse, 'csv'> = { deleted: [], missing: [], failed: [] };
    for (const rel of new Set(rels)) {
      try {
        let abs: string;
        try {
          abs = await safeResolveExisting(settings.gamesDir, rel);
        } catch (err) {
          if (err instanceof NotFoundError) {
            result.missing.push(rel);
            continue;
          }
          throw err;
        }
        assertNotProtected(abs);
        const st = await fs.stat(abs);
        if (!st.isFile()) throw new ValidationError(t('Only files can be deleted'));
        await fs.unlink(abs);
        result.deleted.push(rel);
      } catch (err) {
        const code = errorCode(err);
        if (code === 'ENOENT') result.missing.push(rel);
        else {
          const error = code === 'EACCES' || code === 'EPERM' ? t('No access to the file') : errorMessage(err);
          result.failed.push({ rel, error });
          journal('error', t('Could not delete “{rel}”: {error}', { rel, error }));
        }
      }
    }
    invalidateScan();
    journal(
      result.failed.length ? 'warn' : 'success',
      t('Deleting games: deleted {length}, already missing {length1}, errors {length2}', {
        length: result.deleted.length,
        length1: result.missing.length,
        length2: result.failed.length,
      }),
    );
    if (result.deleted.length <= 20) result.deleted.forEach((r) => journal('info', t('Game file deleted: {r}', { r })));

    const csvResult: CsvRemoval = { updated: false, removed: 0, reason: null, backupPath: null };
    const gone = [...result.deleted, ...result.missing];
    if (removeFromCsv && gone.length) {
      if (!settings.csvPath) {
        csvResult.reason = t('CSV is not configured');
      } else {
        try {
          const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
          if (!csv.exists) {
            csvResult.reason = t('The CSV file has not been created yet');
          } else {
            const { csv: next, removed } = removeEntries(csv, settings.csv.columns, settings.csv.pathPrefix, gone);
            if (removed) {
              csvResult.backupPath = await writeCsv(settings.csvPath, next);
              csvResult.updated = true;
              csvResult.removed = removed;
              journal(
                'success',
                t('Entries removed from the CSV: {removed} (backup: {backupPath})', { removed, backupPath: csvResult.backupPath }),
              );
            } else {
              csvResult.reason = t('No entries for these games were found in the CSV');
            }
          }
        } catch (err) {
          csvResult.reason = errorMessage(err);
          journal('error', t('The files were deleted, but the CSV was not updated: {message}', { message: errorMessage(err) }));
        }
      }
    }
    // The console's lists lose the lines of the deleted games (and of games that were already gone).
    let listErrors: string[] = [];
    if (gone.length) {
      const location = listsLocation(settings);
      if (location) {
        const lists = await updateConsoleLists(settings, { kind: 'remove', paths: gone.map((rel) => listPath(location.platform, rel)) });
        listErrors = lists.errors;
      }
    }
    return { ...result, csv: csvResult, listErrors };
  });
}

/** Deletes one game (a convenience wrapper over `deleteGames`). */
export async function deleteGame({ rel, removeFromCsv = true }: { rel: string; removeFromCsv?: boolean }): Promise<DeleteGameResponse> {
  const result = await deleteGames({ rels: [rel], removeFromCsv });
  const [failed] = result.failed;
  if (failed) throw new InternalError(failed.error);
  if (result.missing.length) throw new NotFoundError(t('File not found — it may have already been deleted'));
  return { deleted: rel, csv: result.csv, listErrors: result.listErrors ?? [] };
}
