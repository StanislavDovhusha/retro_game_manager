import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Data folders of earlier versions of the application, under its earlier names: "SF3000 Game Manager" (made for one
 * console model) and "Game Manager". They are moved once to the folder of the current name, "Retro Game Manager"
 * (see `moveDataFolder`). The old names below are the only reason they still appear in the code.
 * This module imports nothing of the application: the desktop shell uses it before the server is loaded.
 */

/** The data folders of the browser version, newest first (`~/.game-manager`, `~/.sf3000-manager`). */
export const LEGACY_DATA_DIRS: readonly string[] = [path.join(os.homedir(), '.game-manager'), path.join(os.homedir(), '.sf3000-manager')];
/** The old product names, newest first: the desktop app kept its data in `<appData>/<product name>`. */
export const LEGACY_PRODUCT_NAMES: readonly string[] = ['Game Manager', 'SF3000 Game Manager'];

const exists = (target: string): Promise<boolean> =>
  fs.access(target).then(
    () => true,
    () => false,
  );

export type MoveResult =
  | { moved: false; reason: 'no-old-data' | 'already-in-use' }
  | {
      moved: true;
      /** Entries of the old folder moved over (a folder merged into one of the same name counts once). */
      entries: number;
      /** Old files left out because the new folder already had them (made by the new version at start-up). */
      skipped: string[];
    };

/**
 * Moves `from` into `to`: an entry `to` does not have is moved with a rename; a folder that is in both is merged
 * (its entries are moved the same way); a file that is in both stays as the new version made it.
 */
async function moveInto(from: string, to: string, rel: string, skipped: string[]): Promise<void> {
  for (const name of await fs.readdir(from)) {
    const source = path.join(from, name);
    const target = path.join(to, name);
    const relName = rel ? `${rel}/${name}` : name;
    if (!(await exists(target))) {
      await fs.rename(source, target);
      continue;
    }
    const [sourceStat, targetStat] = await Promise.all([fs.lstat(source), fs.lstat(target)]);
    if (sourceStat.isDirectory() && targetStat.isDirectory()) await moveInto(source, target, relName, skipped);
    else skipped.push(relName);
  }
}

/**
 * Moves the contents of an old data folder into the new one, once: only when the old folder has settings and the new
 * one has none yet (the first start of the new version). Everything moves — the settings, `backups/`, `logs/` and the
 * rest — with renames, so nothing is copied and nothing is lost when a step fails; folders the new version already
 * made (`logs/`) are merged. When every entry has been handled the old folder is deleted. When a step fails the error
 * is thrown and the old folder stays (with what was not moved yet).
 */
export async function moveDataFolder(from: string, to: string): Promise<MoveResult> {
  if (path.resolve(from) === path.resolve(to) || !(await exists(path.join(from, 'settings.json')))) {
    return { moved: false, reason: 'no-old-data' };
  }
  if (await exists(path.join(to, 'settings.json'))) return { moved: false, reason: 'already-in-use' };
  await fs.mkdir(to, { recursive: true });
  const entries = (await fs.readdir(from)).length;
  const skipped: string[] = [];
  await moveInto(from, to, '', skipped);
  await fs.rm(from, { recursive: true, force: true });
  return { moved: true, entries, skipped };
}

export interface FolderMove {
  from: string;
  result?: MoveResult;
  /** Why the move failed (the old folder was kept). */
  error?: string;
}

/**
 * Tries the old folders in turn (newest first) until one is moved; a failure is reported and the next one is not
 * tried, so two old versions are never mixed. Never throws: the caller logs the outcome.
 */
export async function moveLegacyData(candidates: readonly string[], to: string): Promise<FolderMove[]> {
  const out: FolderMove[] = [];
  for (const from of candidates) {
    try {
      const result = await moveDataFolder(from, to);
      out.push({ from, result });
      if (result.moved || result.reason === 'already-in-use') break;
    } catch (err) {
      out.push({ from, error: err instanceof Error ? err.message : String(err) });
      break;
    }
  }
  return out;
}
