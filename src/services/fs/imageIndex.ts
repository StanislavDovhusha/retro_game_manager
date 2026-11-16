import path from 'node:path';
import { IMAGE_EXTENSIONS } from '../../../shared/constants.ts';
import type { ImageFile, ImageFinder, ImagesDirInfo, Settings } from '../../models/index.ts';
import { baseNoExt, extOf, statOrNull } from '../../utils/paths.ts';
import { toSafeFileName } from '../../utils/text.ts';

const key = (rel: string): string => baseNoExt(rel).toLowerCase();

export const isImageFile = (file: string): boolean => IMAGE_EXTENSIONS.includes(extOf(file));

/** MIME types of the supported image formats. */
export const MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * Cover index. Lookup order: manual binding -> next to the game (same relative path) -> images folder (same
 * relative path) -> images folder (same file name) -> images folder (file named after the game title).
 *
 * `existingOverrides` holds the manually bound files that exist on disk; it is computed beforehand (see
 * `existingFiles`) so the lookup itself stays synchronous and does not touch the disk.
 */
export function buildImageIndex({
  gamesImages,
  folderImages,
  existingOverrides = new Set<string>(),
}: {
  gamesImages: ImageFile[];
  folderImages: ImageFile[];
  existingOverrides?: ReadonlySet<string>;
}): ImageFinder {
  const nearGame = new Map<string, ImageFile>();
  for (const image of gamesImages) nearGame.set(key(image.rel), image);

  const folderByRel = new Map<string, ImageFile>();
  const folderByName = new Map<string, ImageFile>();
  for (const image of folderImages) {
    folderByRel.set(key(image.rel), image);
    const name = path.basename(key(image.rel));
    if (!folderByName.has(name)) folderByName.set(name, image);
  }

  return function find(game, overrides = {}) {
    const manual = overrides[game.rel];
    if (manual && existingOverrides.has(manual)) return { abs: manual, source: 'manual' };

    const gameKey = key(game.rel);
    // The last resort is the title from the CSV: that is how covers added through "Add game" are found.
    const byTitle = game.title ? folderByName.get(toSafeFileName(game.title).toLowerCase()) : undefined;
    const hit = nearGame.get(gameKey) ?? folderByRel.get(gameKey) ?? folderByName.get(path.basename(gameKey)) ?? byTitle;
    return hit ? { abs: hit.abs, source: 'auto', rel: hit.rel } : null;
  };
}

/** Which of the given files exist (checked in parallel, without blocking the event loop). */
export async function existingFiles(files: Iterable<string>): Promise<Set<string>> {
  const unique = [...new Set(files)];
  const found = await Promise.all(unique.map(async (file) => ((await statOrNull(file))?.isFile() ? file : null)));
  return new Set(found.filter((file): file is string => file !== null));
}

/**
 * The images folder: the one chosen by the user or, when not set, the "images" subfolder of the games folder
 * (if it exists).
 */
export async function resolveImagesDir(settings: Pick<Settings, 'imagesDir' | 'gamesDir'>): Promise<ImagesDirInfo | null> {
  const isDir = async (dir: string): Promise<boolean> => Boolean((await statOrNull(dir))?.isDirectory());
  if (settings.imagesDir && (await isDir(settings.imagesDir))) return { path: settings.imagesDir, isDefault: false };
  if (settings.gamesDir) {
    for (const name of ['images', 'Images']) {
      const dir = path.join(settings.gamesDir, name);
      if (await isDir(dir)) return { path: dir, isDefault: true };
    }
  }
  return null;
}
