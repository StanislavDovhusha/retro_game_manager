import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { IMAGE_EXTENSIONS, SERVICE_EXTENSIONS } from '../../../shared/constants.ts';
import type { GameFile, ImageFile, ScanError, ScanResult } from '../../models/index.ts';
import { errorMessage } from '../../utils/guards.ts';
import { baseNoExt, extOf, isProtectedName } from '../../utils/paths.ts';

/**
 * Recursively scans the games folder.
 * Returns the game files, the subfolders and the images found next to the games.
 * Hidden files and folders (starting with ".") are skipped; symlinked folders are not followed. Service files (.cue,
 * .ccd, .sub, CSV, backups, …) are never games, even when their extension is in the list.
 */
export async function scanGames(root: string, extensions: string[] = [], skipDirs: string[] = []): Promise<ScanResult> {
  const skip = new Set(skipDirs.map((dir) => path.resolve(dir)));
  const allowed = new Set(extensions.map((ext) => ext.toLowerCase()));
  const files: GameFile[] = [];
  const dirs: string[] = [];
  const images: ImageFile[] = [];
  const errors: ScanError[] = [];

  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (err) {
      errors.push({ path: relDir || '.', message: errorMessage(err) });
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (skip.has(path.resolve(abs))) continue; // the images folder is not a games folder
        if (isProtectedName(entry.name)) continue; // rootfs/cubegm hold system files of the card, not games
        dirs.push(rel);
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const ext = extOf(entry.name);
        if (IMAGE_EXTENSIONS.includes(ext)) {
          images.push({ rel, abs });
          continue;
        }
        if (SERVICE_EXTENSIONS.includes(ext)) continue;
        if (allowed.size && !allowed.has(ext)) continue;
        try {
          const st = await fs.stat(abs);
          files.push({
            rel,
            abs,
            name: baseNoExt(entry.name),
            fileName: entry.name,
            ext,
            dir: relDir,
            size: st.size,
            mtime: st.mtimeMs,
          });
        } catch (err) {
          errors.push({ path: rel, message: errorMessage(err) });
        }
      }
    }
  }

  await walk(root, '');
  return { files, dirs, images, errors };
}

/** Scans the images folder. */
export async function scanImages(root: string): Promise<ImageFile[]> {
  const images: ImageFile[] = [];
  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile() && IMAGE_EXTENSIONS.includes(extOf(entry.name))) images.push({ rel, abs });
    }
  }
  await walk(root, '');
  return images;
}
