import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cardMarkerNames } from '../services/devices/registry.ts';

/**
 * Where removable media (an SD card in a reader) usually shows up. No path is hardcoded for one card:
 * - Windows: a drive letter (`E:\`);
 * - macOS: a folder in `/Volumes`;
 * - Linux: a folder in `/media/<user>` or `/run/media/<user>` (desktop auto-mount), `/media` or `/mnt` (manual mount).
 * Everything the code needs from the system goes through `MountEnv`, so every platform can be tested on any host.
 */
export interface MountEnv {
  platform: NodeJS.Platform;
  userName: string;
  /** The drive Windows is installed on, e.g. `C:` — it is never an SD card. */
  systemDrive: string;
  /** Names of the sub-folders of `dir`; an empty list when it cannot be read. */
  listDirs(dir: string): Promise<string[]>;
  isDir(dir: string): Promise<boolean>;
  realPath(target: string): Promise<string>;
}

export interface SdCandidate {
  path: string;
  /** Folder name, or the drive letter on Windows. */
  name: string;
  /** The card has, in its root, the folders by which a known console model is recognized (`cubegm`, `rootfs`, …). */
  looksLikeCard: boolean;
}

const DRIVE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** The path module of the target system, so Windows paths are built correctly on any host. */
const pathFor = (platform: NodeJS.Platform): typeof path.posix => (platform === 'win32' ? path.win32 : path.posix);

/** Folders under which the system mounts removable media, most specific first. */
export function mountBases(env: Pick<MountEnv, 'platform' | 'userName'>): string[] {
  const p = pathFor(env.platform);
  if (env.platform === 'darwin') return [p.join('/', 'Volumes')];
  if (env.platform === 'linux') {
    return [p.join('/', 'media', env.userName), p.join('/', 'run', 'media', env.userName), p.join('/', 'media'), p.join('/', 'mnt')];
  }
  return [];
}

async function candidatesOnWindows(env: MountEnv): Promise<SdCandidate[]> {
  const system = env.systemDrive.replace(/[:\\/]+$/, '').toUpperCase();
  const roots = DRIVE_LETTERS.filter((letter) => letter !== system).map((letter) => ({
    letter,
    root: path.win32.join(`${letter}:`, '\\'),
  }));
  const present = await Promise.all(roots.map(async (drive) => ((await env.isDir(drive.root)) ? drive : null)));
  return Promise.all(
    present
      .filter((drive) => drive !== null)
      .map(async ({ letter, root }) => ({ path: root, name: `${letter}:`, looksLikeCard: await hasCardFolders(env, root) })),
  );
}

async function candidatesInBases(env: MountEnv): Promise<SdCandidate[]> {
  const p = pathFor(env.platform);
  const found = new Map<string, SdCandidate>();
  for (const base of mountBases(env)) {
    for (const name of await env.listDirs(base)) {
      if (name.startsWith('.') || name === env.userName) continue; // `/media/<user>` is itself a base, not a card
      const dir = p.join(base, name);
      if (found.has(dir)) continue;
      // The boot volume is listed in /Volumes as a link to `/`; it is not a card.
      if (env.platform === 'darwin' && (await env.realPath(dir).catch(() => dir)) === '/') continue;
      found.set(dir, { path: dir, name, looksLikeCard: await hasCardFolders(env, dir) });
    }
  }
  return [...found.values()];
}

async function hasCardFolders(env: MountEnv, root: string): Promise<boolean> {
  const names = (await env.listDirs(root)).map((name) => name.toLowerCase());
  return cardMarkerNames.some((marker) => names.includes(marker));
}

/** Mounted volumes that may be an SD card; cards of a known console model come first. */
export async function findSdCandidates(env: MountEnv = systemMountEnv()): Promise<SdCandidate[]> {
  const all = env.platform === 'win32' ? await candidatesOnWindows(env) : await candidatesInBases(env);
  return all.sort((a, b) => Number(b.looksLikeCard) - Number(a.looksLikeCard));
}

/**
 * The folder a "choose the SD card" dialog should open in: the card itself when it is recognised, otherwise the
 * first mounted volume, otherwise the folder where cards are mounted. `undefined` leaves the choice to the system.
 */
export async function suggestSdFolder(env: MountEnv = systemMountEnv()): Promise<string | undefined> {
  const [first] = await findSdCandidates(env);
  if (first) return first.path;
  for (const base of mountBases(env)) if (await env.isDir(base)) return base;
  return undefined;
}

const PROBE_TIMEOUT_MS = 1_500;

/** An empty card reader or an unreachable network drive may block; give up on such a drive quickly. */
const withTimeout = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), PROBE_TIMEOUT_MS).unref())]);

/** The real system. */
export function systemMountEnv(): MountEnv {
  let userName = process.env.USER ?? process.env.USERNAME ?? '';
  try {
    userName = os.userInfo().username;
  } catch {
    /* keep the environment's value */
  }
  return {
    platform: process.platform,
    userName,
    systemDrive: process.env.SystemDrive ?? 'C:',
    async listDirs(dir) {
      try {
        const entries = await withTimeout(fs.readdir(dir, { withFileTypes: true }), []);
        return entries.filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name);
      } catch {
        return [];
      }
    },
    isDir: (dir) =>
      withTimeout(
        fs.stat(dir).then(
          (stat) => stat.isDirectory(),
          () => false,
        ),
        false,
      ),
    realPath: (target) => fs.realpath(target),
  };
}
