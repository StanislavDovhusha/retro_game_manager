import { t } from '../i18n/index.ts';
import type { GameFile, Library, LibraryFile } from '../models/index.ts';
import { errorMessage } from '../utils/guards.ts';
import { statOrNull } from '../utils/paths.ts';
import { readCsv } from './csv/store.ts';
import { csvLookup } from './csv/plan.ts';
import { buildImageIndex, existingFiles, resolveImagesDir } from './fs/imageIndex.ts';
import { scanGames, scanImages } from './fs/scanner.ts';
import { journal } from './journalService.ts';
import { getSettings } from './settingsService.ts';
import { csvReadOptions } from './deviceService.ts';

/** The result of the last scan: lets covers be served without walking the disk again. */
export interface LastScan {
  files: GameFile[];
  imageByRel: Map<string, string>;
  scannedAt: number;
}

let last: LastScan | null = null;
export const getLastScan = (): LastScan | null => last;
export const invalidateScan = (): void => {
  last = null;
};

export async function scanLibrary(): Promise<Library> {
  const settings = await getSettings();
  const started = Date.now();
  const result: Library = {
    gamesDir: { path: settings.gamesDir, exists: false, error: null },
    imagesDir: { path: null, isDefault: false },
    files: [],
    dirs: [],
    errors: [],
    csv: { configured: Boolean(settings.csvPath), ok: false, exists: false, error: null, rows: 0 },
    counts: { games: 0, csvEntries: 0, inCsv: 0, missingInCsv: 0, withImage: 0, totalSize: 0 },
    scannedAt: Date.now(),
    durationMs: 0,
  };

  if (!settings.gamesDir) {
    result.gamesDir.error = t('The games folder is not selected');
    last = null;
    return result;
  }
  const st = await statOrNull(settings.gamesDir);
  if (!st?.isDirectory()) {
    result.gamesDir.error = t('The folder is unavailable or has been deleted');
    last = null;
    return result;
  }
  result.gamesDir.exists = true;

  const imagesDir = await resolveImagesDir(settings);
  result.imagesDir = imagesDir ?? result.imagesDir;
  const scan = await scanGames(settings.gamesDir, settings.extensions, imagesDir ? [imagesDir.path] : []);
  const folderImages = imagesDir ? await scanImages(imagesDir.path) : [];
  const existingOverrides = await existingFiles(Object.values(settings.imageOverrides));
  const findImage = buildImageIndex({ gamesImages: scan.images, folderImages, existingOverrides });

  // The CSV is optional for browsing the files.
  let lookup: ReturnType<typeof csvLookup> | null = null;
  if (settings.csvPath) {
    try {
      const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
      result.csv.rows = csv.rows.length;
      result.csv.exists = csv.exists;
      lookup = csvLookup(csv, settings.csv.columns, settings.csv.pathPrefix);
      result.counts.csvEntries = lookup.size;
      result.csv.ok = true;
    } catch (err) {
      result.csv.error = errorMessage(err);
    }
  }

  const imageByRel = new Map<string, string>();
  result.files = scan.files.map((file): LibraryFile => {
    const hit = lookup ? lookup.get(file.rel.toLowerCase()) : undefined;
    const image = findImage({ ...file, title: hit?.name }, settings.imageOverrides);
    if (image) imageByRel.set(file.rel, image.abs);
    const inCsv = lookup ? Boolean(hit) : null;
    if (inCsv) result.counts.inCsv += 1;
    // Title: the 2nd CSV column, or the file name without extension when there is none.
    const csvName = hit?.name || null;
    return {
      ...file,
      title: csvName || file.name,
      csvName,
      csvShort: hit?.short || null,
      tags: hit?.tags ?? [],
      hasImage: Boolean(image),
      imageSource: image?.source ?? null,
      imageName: image ? (image.abs.split(/[\\/]/).pop() ?? null) : null,
      imageAbs: image?.abs ?? null,
      inCsv,
    };
  });
  result.dirs = scan.dirs;
  result.errors = scan.errors;
  result.counts.games = scan.files.length;
  result.counts.withImage = imageByRel.size;
  result.counts.missingInCsv = lookup ? scan.files.length - result.counts.inCsv : 0;
  // Total size: every file is counted once (the key is the relative path).
  const seen = new Set<string>();
  for (const file of scan.files) {
    if (seen.has(file.rel)) continue;
    seen.add(file.rel);
    result.counts.totalSize += file.size;
  }
  result.durationMs = Date.now() - started;

  last = { files: scan.files, imageByRel, scannedAt: result.scannedAt };
  journal(
    'info',
    t('Scan: games found — {games}, folders — {length} ({durationMs} ms)', {
      games: result.counts.games,
      length: scan.dirs.length,
      durationMs: result.durationMs,
    }),
  );
  for (const error of scan.errors) journal('warn', t('Could not read “{path}”: {message}', { path: error.path, message: error.message }));
  return result;
}
