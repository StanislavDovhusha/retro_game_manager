import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { platformName, platformOrder, type DeviceProfile } from '../../shared/devices.ts';
import { t } from '../i18n/index.ts';
import type { Platform, PlatformPaths, SdNode, SdNodeKind, SdTree } from '../models/index.ts';
import { activeDevice } from './deviceService.ts';
import { BadRequestError, ForbiddenError, NotFoundError, PathTraversalError } from '../utils/errors.ts';
import {
  assertAbsoluteInside,
  assertDirectory,
  assertSafeRelative,
  hasProtectedSegment,
  isInside,
  isProtectedName,
  statOrNull,
} from '../utils/paths.ts';

/**
 * The memory card of the console: the root holds the platform folders (GBA, SFC, PS, ...), media and system folders,
 * as described by the profile of the chosen console model (`devices/`).
 * This module only reads: nothing is created, renamed or deleted here.
 */

// File system and recycle bin service folders: not needed on the card and not shown in the platform list.
const JUNK = new Set(['system volume information', '$recycle.bin', 'lost.dir', 'found.000', 'trash', '.trashes']);

/** Media folders of the model (books, photos, music, movies), lower case. */
const mediaOf = (device: DeviceProfile): Set<string> => new Set(device.folders.media.map((name) => name.toLowerCase()));

const MAX_CHILDREN = 1000;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const isHidden = (name: string): boolean => name.startsWith('.');

async function subdirs(abs: string): Promise<Dirent[]> {
  const entries = await fs.readdir(abs, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !isHidden(entry.name));
}

/** The card root must be an absolute path to an existing folder. */
export async function assertSdRoot(root: string): Promise<void> {
  if (!root) throw new BadRequestError(t('The SD card root is not selected'));
  assertAbsoluteInside(root, null, t('SD card root'));
  await assertDirectory(root, t('SD card root'));
}

/**
 * Platform paths: the images folder and the CSV. What exists on the card is used, otherwise the names of the model's
 * profile (`images`, `filelist.csv`).
 */
export async function detectPlatformPaths(platformAbs: string, device: DeviceProfile): Promise<PlatformPaths> {
  const coversName = device.covers.folder;
  const csvName = device.csv.fileName;
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(platformAbs, { withFileTypes: true });
  } catch {
    /* an empty or unreadable folder */
  }
  const dir = entries.find((entry) => entry.isDirectory() && entry.name.toLowerCase() === coversName.toLowerCase());
  const csvs = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'));
  const csv = csvs.find((entry) => entry.name.toLowerCase() === csvName.toLowerCase()) ?? (csvs.length === 1 ? csvs[0] : null);
  return {
    imagesDir: path.join(platformAbs, dir ? dir.name : coversName),
    csvPath: path.join(platformAbs, csv ? csv.name : csvName),
    imagesExist: Boolean(dir),
    csvExists: Boolean(csv),
  };
}

/** The game folders of the card root (without media, system and service folders). */
export async function listPlatforms(root: string): Promise<Platform[]> {
  await assertSdRoot(root);
  const device = await activeDevice();
  const media = mediaOf(device);
  const out: Platform[] = [];
  for (const entry of await subdirs(root)) {
    const key = entry.name.toLowerCase();
    if (media.has(key) || isProtectedName(key) || JUNK.has(key)) continue;
    const abs = path.join(root, entry.name);
    out.push({
      name: entry.name,
      label: platformName(device, entry.name),
      known: platformOrder(device, entry.name) >= 0,
      path: abs,
      ...(await detectPlatformPaths(abs, device)),
    });
  }
  out.sort((a, b) => {
    if (a.known !== b.known) return a.known ? -1 : 1;
    // Known platforms in the order of the model's profile, the others by name.
    return a.known ? platformOrder(device, a.name) - platformOrder(device, b.name) : collator.compare(a.name, b.name);
  });
  return out;
}

/** Finds a platform by name among the real folders of the card (the requested name is never joined to a path directly). */
export async function findPlatform(root: string, name: string): Promise<Platform> {
  const list = await listPlatforms(root);
  const found = list.find((platform) => platform.name === name);
  if (!found) {
    if (isProtectedName(name)) {
      throw new ForbiddenError(t('System folders of the console cannot be modified: {p}', { p: name }));
    }
    throw new NotFoundError(t('Platform “{name}” was not found on the memory card', { name }));
  }
  return found;
}

function kindOf(rel: string, name: string, media: ReadonlySet<string>): SdNodeKind {
  const key = name.toLowerCase();
  if (isProtectedName(key)) return 'system';
  if (rel === name) {
    // top level
    if (media.has(key)) return 'media';
    if (JUNK.has(key)) return 'junk';
    return 'platform';
  }
  return 'folder';
}

/** Folders one level down (for the lazy tree). `rel` is relative to the card root; '' is the root itself. */
export async function listChildren(root: string, rel = ''): Promise<SdTree> {
  await assertSdRoot(root);
  const clean = rel ? assertSafeRelative(rel).replace(/\/+$/, '') : '';
  if (hasProtectedSegment(clean)) return { rel: clean, nodes: [], truncated: false }; // system folders are not expanded
  const abs = clean ? path.join(root, clean) : root;
  if (clean) {
    if (!isInside(root, abs)) throw new PathTraversalError(t('The path goes outside the folder'));
    // The real path (symlinks resolved) must stay inside the card as well.
    const real = await fs.realpath(abs).catch(() => null);
    const realRoot = await fs.realpath(root);
    if (!real || !isInside(realRoot, real)) throw new NotFoundError(t('Folder not found'));
    if (!(await statOrNull(abs))?.isDirectory()) throw new NotFoundError(t('Folder not found'));
  }
  const all = (await subdirs(abs)).sort((a, b) => collator.compare(a.name, b.name));
  const device = await activeDevice();
  const media = mediaOf(device);
  const truncated = all.length > MAX_CHILDREN;
  const nodes: SdNode[] = [];
  for (const entry of all.slice(0, MAX_CHILDREN)) {
    const childRel = clean ? `${clean}/${entry.name}` : entry.name;
    let hasChildren = false;
    // The contents of system folders are not expanded: they are only shown.
    if (!isProtectedName(entry.name)) {
      try {
        hasChildren = (await subdirs(path.join(abs, entry.name))).length > 0;
      } catch {
        /* no access */
      }
    }
    const kind = kindOf(childRel, entry.name, media);
    nodes.push({
      name: entry.name,
      rel: childRel,
      kind,
      hasChildren,
      label: kind === 'platform' ? platformName(device, entry.name) : null,
    });
  }
  return { rel: clean, nodes, truncated };
}
