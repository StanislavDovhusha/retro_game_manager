import path from 'node:path';
import type { SearchGame, SearchIndex, Settings } from '../models/index.ts';
import { errorMessage } from '../utils/guards.ts';
import { readCsv } from './csv/store.ts';
import { csvLookup } from './csv/plan.ts';
import { scanGames } from './fs/scanner.ts';
import { listPlatforms } from './sdCardService.ts';
import { getSettings } from './settingsService.ts';
import { csvReadOptions } from './deviceService.ts';
import { platformName } from '../../shared/devices.ts';
import { deviceById } from './devices/registry.ts';

/**
 * The index of the global search: the games of every platform folder of the card with their CSV titles, short titles
 * and tags. Only reads. The folders the platform list leaves out (rootfs, cubegm, Ebook, Photo, BGM, Movie, service
 * folders of the file system) are not searched; neither are the images folders and the side files of disc images.
 * The client keeps the result and asks again after the library changes.
 */
export async function buildSearchIndex(): Promise<SearchIndex> {
  const settings = await getSettings();
  const index: SearchIndex = { root: settings.sdRoot, games: [], errors: [], builtAt: Date.now() };

  if (!settings.sdRoot) {
    // No card: the games folder that is open is the only one there is.
    if (settings.gamesDir) {
      const folder = path.basename(settings.gamesDir);
      await indexFolder(index, settings, {
        platform: '',
        folder,
        dir: settings.gamesDir,
        imagesDir: settings.imagesDir,
        csvPath: settings.csvPath,
      });
    }
    return index;
  }

  let platforms;
  try {
    platforms = await listPlatforms(settings.sdRoot);
  } catch (err) {
    index.errors.push({ folder: '', message: errorMessage(err) });
    return index;
  }
  // One folder after another: a card reader serves one request at a time anyway.
  for (const platform of platforms) {
    await indexFolder(index, settings, {
      platform: platform.name,
      folder: platform.name,
      dir: platform.path,
      imagesDir: platform.imagesDir,
      csvPath: platform.csvPath,
    });
  }
  return index;
}

interface FolderToIndex {
  platform: string;
  folder: string;
  dir: string;
  imagesDir: string;
  csvPath: string;
}

async function indexFolder(index: SearchIndex, settings: Settings, target: FolderToIndex): Promise<void> {
  const scan = await scanGames(target.dir, settings.extensions, target.imagesDir ? [target.imagesDir] : []);
  // An unreadable subfolder is reported; an unreadable platform folder has no games to show.
  for (const error of scan.errors) index.errors.push({ folder: target.folder, message: `${error.path}: ${error.message}` });

  let lookup: ReturnType<typeof csvLookup> | null = null;
  if (target.csvPath) {
    try {
      const csv = await readCsv(target.csvPath, csvReadOptions(settings), { allowMissing: true });
      lookup = csvLookup(csv, settings.csv.columns, settings.csv.pathPrefix);
    } catch (err) {
      // Without the CSV the games are still found, by their file names.
      index.errors.push({ folder: target.folder, message: `${path.basename(target.csvPath)}: ${errorMessage(err)}` });
    }
  }

  const device = deviceById(settings.device);
  for (const file of scan.files) {
    const hit = lookup?.get(file.rel.toLowerCase());
    index.games.push({
      platform: target.platform,
      folder: target.folder,
      platformName: platformName(device, target.folder),
      rel: file.rel,
      fileName: file.fileName,
      title: hit?.name || file.name,
      short: hit?.short ?? '',
      tags: hit?.tags ?? [],
    } satisfies SearchGame);
  }
}
