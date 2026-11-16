import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { t } from '../i18n/index.ts';
import type { OpenBackupsResponse } from '../models/index.ts';
import { dataPaths } from '../utils/dataPaths.ts';
import { InternalError } from '../utils/errors.ts';
import { errorCode, errorMessage } from '../utils/guards.ts';
import { logger } from '../utils/logger.ts';
import { isInside, isProtectedName, statOrNull } from '../utils/paths.ts';
import { journal } from './journalService.ts';
import { getSettings } from './settingsService.ts';

/**
 * Backups of the files the application changes on the card (filelist.csv, the cubegm lists, cores/filelist.xml).
 * They are kept on the computer, never on the card:
 *
 *   <data>/backups/<card id>/<platform folder>/<file name>.bak-<time>
 *
 * The card id keeps the backups of different cards apart: the volume label and serial number when the system tells
 * them, otherwise a hash of the path of the card root. The last MAX_BACKUPS copies of every file are kept.
 */

export const MAX_BACKUPS = 10;
/** `filelist.csv.bak-2026-11-13T13-02-31-843Z` — the name every backup has (and the old ones on the card had). */
const BACKUP_NAME = /^(.+)\.bak-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(?:-\d+)?$/;
/**
 * Leftovers of interrupted writes: `.Game.img.part-1234` (copies) and `filelist.csv.tmp-1234-1700000000000`; the
 * number is the id of the process that wrote them.
 */
const LEFTOVER = /^\..+\.part-(\d+)$|\.tmp-(\d+)-\d+$/;
const PROBE_TIMEOUT_MS = 3_000;

export const backupStamp = (date = new Date()): string => date.toISOString().replace(/[:.]/g, '-');

// ── The card id ───────────────────────────────────────────────────────────────────────────

export interface VolumeInfo {
  label: string | null;
  serial: string | null;
}
export type VolumeProbe = (mountPoint: string) => Promise<VolumeInfo>;

const run = (cmd: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(String(stdout)),
    );
  });

const plistString = (plist: string, key: string): string | null =>
  new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist)?.[1]?.trim() || null;

/** Label and serial number of the volume mounted at `mountPoint`, asked from the system tools. */
export async function systemVolumeProbe(mountPoint: string): Promise<VolumeInfo> {
  if (process.platform === 'darwin') {
    const plist = await run('diskutil', ['info', '-plist', mountPoint]);
    return { label: plistString(plist, 'VolumeName'), serial: plistString(plist, 'VolumeUUID') ?? plistString(plist, 'DiskUUID') };
  }
  if (process.platform === 'win32') {
    // `vol E:` prints the serial as XXXX-XXXX in every language of Windows; the label line is translated, so it is not read.
    const out = await run('cmd.exe', ['/d', '/c', 'vol', mountPoint.slice(0, 2)]);
    return { label: null, serial: /\b([0-9A-F]{4}-[0-9A-F]{4})\b/i.exec(out)?.[1] ?? null };
  }
  const out = await run('findmnt', ['-n', '-P', '-o', 'UUID,LABEL', '--target', mountPoint]);
  const value = (key: string): string | null => new RegExp(`${key}="([^"]*)"`).exec(out)?.[1] || null;
  return { label: value('LABEL'), serial: value('UUID') };
}

let probe: VolumeProbe = systemVolumeProbe;
const idCache = new Map<string, string>();

/** Replaces the volume probe (tests); `null` restores the system one. Clears the cached ids. */
export function setVolumeProbe(next: VolumeProbe | null): void {
  probe = next ?? systemVolumeProbe;
  idCache.clear();
}

/** A piece of a folder name: letters, digits, dot, dash and underscore only. */
const safeSegment = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 40);

const hashOf = (text: string): string => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);

/** A folder is a mount point when it lives on another device than its parent (or it is the root of a drive). */
async function isMountPoint(dir: string): Promise<boolean> {
  const parent = path.dirname(dir);
  if (parent === dir) return true;
  const [self, up] = await Promise.all([statOrNull(dir), statOrNull(parent)]);
  return Boolean(self && up && self.dev !== up.dev);
}

/**
 * The id of a card (or of any folder used as one): `<label>_<serial>` when the volume can be identified, otherwise
 * `<folder name>_path-<hash of the path>`.
 */
export async function cardIdOf(root: string): Promise<string> {
  const resolved = path.resolve(root);
  const cached = idCache.get(resolved);
  if (cached) return cached;
  let info: VolumeInfo = { label: null, serial: null };
  if (await isMountPoint(resolved)) {
    info = await probe(resolved).catch((err: unknown) => {
      logger.warn({ err, root: resolved }, 'Backups: the volume label and serial number could not be read');
      return { label: null, serial: null };
    });
  }
  const label = safeSegment(info.label ?? path.basename(resolved)) || 'card';
  const serial = info.serial ? safeSegment(info.serial) : '';
  const id = serial ? `${label}_${serial}` : `${label}_path-${hashOf(resolved)}`;
  idCache.set(resolved, id);
  return id;
}

// ── Where a backup goes ───────────────────────────────────────────────────────────────────

/**
 * The backup folder of a file on the card: `backups/<card id>/<platform folder>`. A file outside the selected card
 * (a games folder chosen by hand) is treated as `<parent of its folder>/<its folder>`.
 */
export async function backupDirFor(file: string, platform?: string): Promise<string> {
  const { sdRoot } = await getSettings();
  const dir = path.dirname(path.resolve(file));
  let root: string;
  let folder: string;
  if (sdRoot && isInside(sdRoot, dir)) {
    root = sdRoot;
    folder = platform || path.relative(sdRoot, dir).split(path.sep)[0] || 'root';
  } else {
    root = path.dirname(dir);
    folder = platform || path.basename(dir);
  }
  return path.join(dataPaths.backups, await cardIdOf(root), safeSegment(folder) || 'root');
}

/** Keeps the newest `keep` backups of the file `name` in `dir` and deletes the older ones. */
export async function pruneBackups(dir: string, name: string, keep = MAX_BACKUPS): Promise<void> {
  try {
    const own = (await fs.readdir(dir)).filter((entry) => BACKUP_NAME.exec(entry)?.[1] === name).sort();
    for (const old of own.slice(0, Math.max(0, own.length - keep))) await fs.rm(path.join(dir, old), { force: true });
  } catch (err) {
    logger.warn({ err, dir, name }, 'Backups: old copies could not be removed'); // not critical
  }
}

/** A free name for a new backup (two backups in the same millisecond get a suffix). */
async function freeName(dir: string, name: string, stamp: string): Promise<string> {
  for (let n = 0; ; n += 1) {
    const candidate = path.join(dir, `${name}.bak-${stamp}${n ? `-${n}` : ''}`);
    if (!(await statOrNull(candidate))) return candidate;
  }
}

/**
 * Saves a backup of `file` (its current content, or `data` when given) in the backup folder of the card and keeps
 * the last MAX_BACKUPS copies of it. Returns the path of the backup.
 */
export async function backupFile(file: string, { platform, data }: { platform?: string; data?: Uint8Array } = {}): Promise<string> {
  const dir = await backupDirFor(file, platform);
  await fs.mkdir(dir, { recursive: true });
  const name = path.basename(file);
  const target = await freeName(dir, name, backupStamp());
  if (data) await fs.writeFile(target, data, { flag: 'wx' });
  else await fs.copyFile(file, target, fs.constants.COPYFILE_EXCL);
  await pruneBackups(dir, name);
  return target;
}

// ── Moving the old backups off the card ───────────────────────────────────────────────────

export interface MigrationResult {
  moved: number;
  removedLeftovers: number;
  target: string | null;
}

/** Moves a file to another disk: copy, check the size, delete the original. */
async function moveAcross(from: string, to: string): Promise<void> {
  if (!(await statOrNull(to))) await fs.copyFile(from, to, fs.constants.COPYFILE_EXCL);
  const [a, b] = await Promise.all([fs.stat(from), fs.stat(to)]);
  if (a.size !== b.size) throw new Error(`size mismatch after copying ${from}`);
  await fs.rm(from);
}

/** The `.bak-…` files and the leftovers of interrupted writes in one folder of the card. */
async function cleanFolder(dir: string, backupDir: () => Promise<string>, result: MigrationResult): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  const touched = new Set<string>();
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const backup = BACKUP_NAME.exec(name);
      if (backup) {
        if (!(await statOrNull(file))?.isFile()) continue;
        const target = await backupDir();
        await fs.mkdir(target, { recursive: true });
        await moveAcross(file, path.join(target, name));
        touched.add(`${target}\0${backup[1] ?? name}`);
        result.moved += 1;
        result.target = target;
      } else {
        // A temporary file of this very process may be a write in progress: only those of earlier runs are removed.
        const leftover = LEFTOVER.exec(name);
        const pid = Number(leftover?.[1] ?? leftover?.[2]);
        if (leftover && pid !== process.pid && (await statOrNull(file))?.isFile()) {
          await fs.rm(file, { force: true });
          result.removedLeftovers += 1;
        }
      }
    } catch (err) {
      logger.warn({ err, file }, 'Backups: a file could not be moved off the card');
    }
  }
  for (const key of touched) {
    const [target, base] = key.split('\0');
    if (target && base) await pruneBackups(target, base);
  }
}

/**
 * Moves the backups that older versions left on the card (`<platform>/filelist.csv.bak-…`) to the data folder and
 * deletes them from the card; removes the leftovers of interrupted writes. Looks at the platform folders of the card
 * (and their images folders) and at the folder of a CSV chosen outside the card. Nothing happens when there is
 * nothing to move, so it is safe to run every time a card is opened.
 */
export async function migrateBackups({ sdRoot, csvPath }: { sdRoot: string; csvPath: string }): Promise<MigrationResult> {
  const result: MigrationResult = { moved: 0, removedLeftovers: 0, target: null };
  const folders: { dir: string; file: string }[] = [];
  if (sdRoot && (await statOrNull(sdRoot))?.isDirectory()) {
    for (const entry of await fs.readdir(sdRoot, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || isProtectedName(entry.name)) continue;
      const platformDir = path.join(sdRoot, entry.name);
      folders.push({ dir: platformDir, file: path.join(platformDir, 'x') });
      for (const sub of await fs.readdir(platformDir, { withFileTypes: true }).catch(() => [])) {
        if (sub.isDirectory() && sub.name.toLowerCase() === 'images') {
          folders.push({ dir: path.join(platformDir, sub.name), file: path.join(platformDir, 'x') });
        }
      }
    }
  }
  if (csvPath && !(sdRoot && isInside(sdRoot, csvPath))) folders.push({ dir: path.dirname(csvPath), file: csvPath });
  for (const { dir, file } of folders) await cleanFolder(dir, () => backupDirFor(file), result);
  return result;
}

/**
 * Runs the migration for the current card. It does not take the operation lock: it touches only old `.bak-…` files
 * (nothing writes them to the card any more) and leftovers of earlier runs, never files an operation is using.
 */
export async function migrateBackupsInBackground(): Promise<void> {
  try {
    const { sdRoot, csvPath } = await getSettings();
    if (!sdRoot && !csvPath) return;
    const result = await migrateBackups({ sdRoot, csvPath });
    if (result.moved) {
      journal(
        'info',
        t('Old backups moved from the card to the computer: {count} (folder: {dir})', { count: result.moved, dir: result.target ?? '' }),
      );
    }
    if (result.removedLeftovers) {
      journal('info', t('Leftovers of interrupted writes removed from the card: {count}', { count: result.removedLeftovers }));
    }
  } catch (err) {
    logger.warn({ err }, 'Backups: the old backups on the card were not moved this time');
  }
}

// ── Opening the folder ────────────────────────────────────────────────────────────────────

export type FolderOpener = (dir: string) => Promise<void>;

/** Opens a folder in the file manager of the system (Finder, Explorer, the default one on Linux). */
export const systemFolderOpener: FolderOpener = (dir) =>
  new Promise((resolve, reject) => {
    const [cmd, args] =
      process.platform === 'darwin' ? ['open', [dir]] : process.platform === 'win32' ? ['explorer.exe', [dir]] : ['xdg-open', [dir]];
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });

let opener: FolderOpener = systemFolderOpener;

/** Replaces the folder opener (tests); `null` restores the system one. */
export function setFolderOpener(next: FolderOpener | null): void {
  opener = next ?? systemFolderOpener;
}

/** Opens the backup folder of the current card (or the folder of all backups) in the file manager. */
export async function openBackupsFolder(): Promise<OpenBackupsResponse> {
  const { sdRoot } = await getSettings();
  let dir = dataPaths.backups;
  if (sdRoot) {
    const cardDir = path.join(dataPaths.backups, await cardIdOf(sdRoot));
    if ((await statOrNull(cardDir))?.isDirectory()) dir = cardDir;
  }
  await fs.mkdir(dir, { recursive: true });
  try {
    await opener(dir);
  } catch (err) {
    const message =
      errorCode(err) === 'ENOENT'
        ? t('No file manager was found to open the folder: {dir}', { dir })
        : t('The folder could not be opened: {dir} ({message})', { dir, message: errorMessage(err) });
    throw new InternalError(message, { cause: err, expose: true }); // the user needs to see which folder it was
  }
  return { path: dir };
}
