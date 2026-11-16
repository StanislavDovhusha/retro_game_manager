import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { t } from '../i18n/index.ts';
import type { DeleteImageResponse, SetImageResponse } from '../models/index.ts';
import { NotFoundError, PathTraversalError, ValidationError } from '../utils/errors.ts';
import { errorMessage } from '../utils/guards.ts';
import { runExclusive } from '../utils/lock.ts';
import {
  assertAbsoluteInside,
  assertFile,
  assertNotProtected,
  baseNoExt,
  extOf,
  isInside,
  safeResolveExisting,
  statOrNull,
} from '../utils/paths.ts';
import { convertToPng, writePng } from './fs/imageConvert.ts';
import { assertImageFile } from './fs/imageSignature.ts';
import { isImageFile, MIME, resolveImagesDir } from './fs/imageIndex.ts';
import { journal } from './journalService.ts';
import { getLastScan, invalidateScan, scanLibrary } from './libraryService.ts';
import { getSettings, patchInternal } from './settingsService.ts';

/** The absolute path of the cover of a game (from the last scan; the library is scanned first if needed). */
export async function getImagePath(rel: string): Promise<string | null> {
  let scan = getLastScan();
  if (!scan) {
    await scanLibrary();
    scan = getLastScan();
  }
  return scan?.imageByRel.get(rel) ?? null;
}

/** Opens the cover of a game for streaming to the client. */
export async function openImage(rel: string): Promise<{ stream: Readable; contentType: string }> {
  const abs = await getImagePath(rel);
  const st = abs ? await fsp.stat(abs).catch(() => null) : null;
  if (!abs || !st?.isFile()) throw new NotFoundError(t('Image not found'));
  return { stream: fs.createReadStream(abs), contentType: MIME[extOf(abs)] ?? 'application/octet-stream' };
}

/**
 * Deletes a cover file, but only inside the given folders (the real path is checked, so a symlink cannot lead out).
 * Returns false when the file is outside them: such a file is never deleted from disk.
 */
async function deleteInsideRoots(imageAbs: string, roots: readonly string[]): Promise<boolean> {
  assertNotProtected(imageAbs);
  const root = roots.find((candidate) => isInside(candidate, imageAbs));
  if (!root) return false;
  const [real, realRoot] = await Promise.all([fsp.realpath(imageAbs), fsp.realpath(root)]);
  if (!isInside(realRoot, real)) throw new PathTraversalError(t('The image is outside the selected folder'));
  await fsp.unlink(imageAbs);
  return true;
}

async function isSameFile(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([statOrNull(a), statOrNull(b)]);
  return Boolean(x && y && x.ino === y.ino && x.dev === y.dev);
}

/**
 * Deletes only the image of a game. Files outside the games and images folders are never deleted from disk:
 * only the binding is removed.
 */
export async function deleteImage({ rel }: { rel: string }): Promise<DeleteImageResponse> {
  const settings = await getSettings();
  const imageAbs = await getImagePath(rel);
  if (!imageAbs) throw new NotFoundError(t('This game has no image'));

  const imagesDir = await resolveImagesDir(settings);
  const roots = [settings.gamesDir, imagesDir?.path].filter((root): root is string => Boolean(root));
  const deleted = await deleteInsideRoots(imageAbs, roots);
  if (deleted) journal('success', t('Image deleted: {imageAbs}', { imageAbs }));
  else {
    journal(
      'warn',
      t('An image outside the selected folders is not deleted from disk; only the link was removed: {imageAbs}', { imageAbs }),
    );
  }
  await patchInternal((s) => {
    delete s.imageOverrides[rel];
  });
  invalidateScan();
  return { deleted, path: imageAbs };
}

/**
 * A new cover for a game. The picture (PNG, JPG, JPEG, WEBP, BMP, GIF) is converted to PNG and saved in the images
 * folder as `<game file name without extension>.png`, which is where the cover of the game is looked for. Only after
 * the new file is saved are the old covers of the game in other formats removed (a cover outside the games and
 * images folders is never deleted from disk; its manual link is dropped).
 */
export function setImage({ rel, imagePath }: { rel: string; imagePath: string }): Promise<SetImageResponse> {
  return runExclusive(t('changing a cover'), async () => {
    const settings = await getSettings();
    const gameAbs = await safeResolveExisting(settings.gamesDir, rel);
    const image = assertAbsoluteInside(imagePath, null, t('Image'));
    await assertFile(image, t('Image'));
    if (!isImageFile(image)) throw new ValidationError(t('Supported formats: png, jpg, jpeg, bmp, gif, webp'));
    await assertImageFile(image);

    const stem = baseNoExt(path.basename(gameAbs));
    const known = await resolveImagesDir(settings);
    const imagesDir = known?.path ?? (settings.imagesDir || path.join(settings.gamesDir, 'images'));
    const oldCover = await getImagePath(rel);
    // A cover that already lives in a subfolder of the images folder keeps its place; otherwise the cover goes to the folder itself.
    const dir = oldCover && isInside(imagesDir, oldCover) ? path.dirname(oldCover) : imagesDir;
    const target = path.join(dir, `${stem}.png`);
    assertNotProtected(target);

    const png = await convertToPng(image); // nothing is touched when the picture cannot be converted
    await fsp.mkdir(dir, { recursive: true });
    await writePng(target, png);

    // The new cover is saved: now the old ones go.
    const old = new Set<string>(oldCover ? [oldCover] : []);
    for (const name of await fsp.readdir(dir).catch(() => [] as string[])) {
      if (baseNoExt(name).toLowerCase() === stem.toLowerCase() && isImageFile(name)) old.add(path.join(dir, name));
    }
    const roots = [settings.gamesDir, imagesDir];
    for (const file of old) {
      try {
        if (await isSameFile(file, target)) continue;
        if (await deleteInsideRoots(file, roots)) journal('info', t('The old cover was removed: {file}', { file }));
      } catch (err) {
        journal('warn', t('The old cover could not be removed: {file} ({message})', { file, message: errorMessage(err) }));
      }
    }
    await patchInternal((s) => {
      delete s.imageOverrides[rel]; // the cover is now found by the name of the game
    });
    invalidateScan();
    journal('success', t('Cover saved as PNG for the game “{rel}”: {imagePath}', { rel, imagePath: target }));
    return { rel, imagePath: target };
  });
}
