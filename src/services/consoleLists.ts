import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeviceProfile } from '../../shared/devices.ts';
import { t } from '../i18n/index.ts';
import type { Settings } from '../models/index.ts';
import { atomicWrite } from '../utils/atomicWrite.ts';
import { errorCode, errorMessage } from '../utils/guards.ts';
import { logger } from '../utils/logger.ts';
import { statOrNull } from '../utils/paths.ts';
import { backupFile } from './backupService.ts';
import { deviceById } from './devices/registry.ts';
import { journal } from './journalService.ts';
import { decodeList, editList, encodeList, newListDocument, type ListChange, type ListDocument } from './lists/listLines.ts';

/**
 * The game lists of the console in its saves folder (`cubegm/allfiles.lst`, `favorites.lst`, `recent.lst`; which ones
 * and their line format come from the console's profile). Besides renaming a game (saves, states and the core
 * bindings: `renameService`), this module is the only place that writes into a system folder of the card, and only
 * these files: a game added gets a line in the main list, a renamed game or a new short name updates its line in every
 * list, a deleted game loses its lines, and the sync brings the lists in line with the files of the platform.
 *
 * Every file is backed up to the data folder before it changes and replaced atomically (temporary file, then rename).
 * Its encoding (UTF-8, or UTF-16 by its byte order mark), byte order mark and line ends are kept, lines that cannot be read are
 * left as they are, and a file that does not read cleanly is never written (an error is shown and logged). A missing
 * main list is created in UTF-8 without a byte order mark. The lists are only touched when the games folder is a platform folder of
 * the chosen card (otherwise there is no card to update).
 */

export interface ListsLocation {
  /** The saves folder on the card (`<card>/cubegm`). */
  dir: string;
  /** The platform folder name, as on the card (`PS`). */
  platform: string;
  device: DeviceProfile;
}

/** Where the lists of the open platform are, or null (no card, no platform, a games folder chosen by hand, no lists). */
export function listsLocation(settings: Settings): ListsLocation | null {
  const { sdRoot, platform, gamesDir } = settings;
  const device = deviceById(settings.device);
  if (!sdRoot || !platform || !device.folders.saves || !device.saves.lists.length) return null;
  if (path.resolve(gamesDir).toLowerCase() !== path.resolve(sdRoot, platform).toLowerCase()) return null;
  return { dir: path.join(sdRoot, device.folders.saves), platform, device };
}

/** A list file that is going to change: its bytes before (null: a new file) and after. */
export interface ListFileEdit {
  file: string;
  name: string;
  original: Buffer | null;
  next: Buffer;
  added: number;
  updated: number;
  removed: number;
}

export interface ListPlan {
  edits: ListFileEdit[];
  warnings: string[];
  /** Lists that are not changed because that could damage them (they do not read cleanly): shown as errors. */
  errors: string[];
}

/** What a change does to every list (reads the files, writes nothing). */
export async function planListChange(location: ListsLocation | null, change: ListChange): Promise<ListPlan> {
  const plan: ListPlan = { edits: [], warnings: [], errors: [] };
  if (!location) return plan;
  const { dir, device } = location;
  if (!(await statOrNull(dir))?.isDirectory()) return plan;
  const format = device.saves.listFormat;
  for (const name of device.saves.lists) {
    const file = path.join(dir, path.normalize(name));
    const isMain = name === device.saves.mainList;
    // Only the main list gets new lines; favorites and recent games follow renames and lose deleted games.
    const forThis: ListChange = change.kind === 'remove' ? change : { ...change, add: change.add && isMain };
    let original: Buffer | null;
    let doc: ListDocument;
    try {
      original = await fs.readFile(file);
    } catch (err) {
      if (errorCode(err) !== 'ENOENT') {
        plan.warnings.push(t('Could not read {name}: {message}', { name, message: errorMessage(err) }));
        continue;
      }
      // A missing list is created only when a line is to be added (the main list): UTF-8, without a byte order mark.
      if (forThis.kind === 'remove' || !forThis.add) continue;
      original = null;
    }
    if (original) {
      const read = decodeList(original);
      if ('problem' in read) {
        const { encoding } = read.problem;
        logger.error({ file, encoding }, 'Console list: does not read cleanly in its encoding, left unchanged');
        plan.errors.push(
          t('{name} does not read correctly as {encoding} — it was not changed, so that it is not damaged', { name, encoding }),
        );
        continue;
      }
      doc = read.doc;
    } else {
      doc = newListDocument();
    }
    const result = editList(doc.lines, format, forThis);
    for (const skipped of result.skipped) {
      plan.warnings.push(
        t('The title or short name of “{path}” contains “{separator}” — its line in {name} is not written', {
          path: skipped,
          separator: format.separator,
          name,
        }),
      );
    }
    if (!result.added && !result.updated && !result.removed) continue;
    // A list that was empty gets the line break after its last line, as the console writes its lists.
    const next = encodeList({ ...doc, lines: result.lines, finalEol: doc.lines.length ? doc.finalEol : true });
    if (!next) {
      logger.error({ file, encoding: doc.encoding }, 'Console list: the new lines cannot be written in its encoding, left unchanged');
      plan.errors.push(
        t('{name}: the new lines cannot be written in its encoding ({encoding}) — it was not changed', { name, encoding: doc.encoding }),
      );
      continue;
    }
    plan.edits.push({ file, name, original, next, added: result.added, updated: result.updated, removed: result.removed });
  }
  return plan;
}

/**
 * Writes the planned lists: each one is backed up to the data folder (a new one has nothing to back up), then
 * replaced atomically. When one fails, the ones already written are put back (a new one is removed) and the error is
 * thrown.
 */
export async function writeListEdits(edits: readonly ListFileEdit[], platform: string): Promise<void> {
  const written: ListFileEdit[] = [];
  try {
    for (const edit of edits) {
      // backups/<card id>/<platform>/allfiles.lst.bak-<time>
      if (edit.original) await backupFile(edit.file, { platform, data: edit.original });
      await atomicWrite(edit.file, edit.next);
      written.push(edit);
    }
  } catch (err) {
    for (const edit of written.reverse()) {
      await (edit.original ? atomicWrite(edit.file, edit.original) : fs.rm(edit.file, { force: true })).catch(() => undefined);
    }
    throw err;
  }
}

/** A short line for the journal: `allfiles.lst +1, favorites.lst −1`. */
export function describeListEdits(edits: readonly ListFileEdit[]): string {
  return edits
    .map((edit) => {
      const parts = [edit.added && `+${edit.added}`, edit.removed && `−${edit.removed}`, edit.updated && `~${edit.updated}`].filter(
        Boolean,
      );
      return `${edit.name} ${parts.join(' ')}`;
    })
    .join(', ');
}

/**
 * Plans and writes a change of the lists after an operation on the games (adding, deleting, a new short name, the
 * sync). The operation itself is already done: a list that cannot be updated does not undo it, it gives a warning.
 */
export async function updateConsoleLists(
  settings: Settings,
  change: ListChange,
): Promise<{ edits: ListFileEdit[]; warnings: string[]; errors: string[] }> {
  const location = listsLocation(settings);
  if (!location) return { edits: [], warnings: [], errors: [] };
  try {
    const plan = await planListChange(location, change);
    await writeListEdits(plan.edits, location.platform);
    const created = plan.edits.filter((edit) => !edit.original).map((edit) => edit.name);
    if (created.length) journal('info', t('Console list created (UTF-8): {lists}', { lists: created.join(', ') }));
    if (plan.edits.length) journal('info', t('Console lists updated: {lists}', { lists: describeListEdits(plan.edits) }));
    for (const warning of plan.warnings) journal('warn', warning);
    for (const error of plan.errors) journal('error', error);
    return plan;
  } catch (err) {
    logger.error({ err }, 'Console lists: could not be updated');
    const error = t('The console lists (.lst) could not be updated: {message}', { message: errorMessage(err) });
    journal('error', error);
    return { edits: [], warnings: [], errors: [error] };
  }
}
