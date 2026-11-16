import type { Platform, PlatformSummary, SdPlatformsResponse, Settings } from '../models/index.ts';
import { readCsv } from './csv/store.ts';
import { csvLookup } from './csv/plan.ts';
import { csvReadOptions } from './deviceService.ts';
import { scanGames } from './fs/scanner.ts';
import { listPlatforms } from './sdCardService.ts';
import { getSettings } from './settingsService.ts';

/**
 * The platform list of the main screen: the platform folders of the card (system, media and service folders are left
 * out by `listPlatforms`) with the number of their games, sorted by the full platform name. Only reads.
 */

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** The name the list is sorted by: the full name from the profile, or the folder name for an unknown folder. */
export const summaryTitle = (platform: Pick<PlatformSummary, 'name' | 'label'>): string => platform.label ?? platform.name;

export const compareSummaries = (a: Pick<PlatformSummary, 'name' | 'label'>, b: Pick<PlatformSummary, 'name' | 'label'>): number =>
  collator.compare(summaryTitle(a), summaryTitle(b)) || collator.compare(a.name, b.name);

/**
 * The games of a platform folder: the entries of its CSV (as the console lists them), or, when there is no CSV or it
 * cannot be read, the game files in the folder (the images folder and the side files of disc images do not count).
 */
export async function countPlatformGames(platform: Platform, settings: Settings): Promise<Pick<PlatformSummary, 'games' | 'counted'>> {
  if (platform.csvExists) {
    try {
      const csv = await readCsv(platform.csvPath, csvReadOptions(settings), { allowMissing: true });
      return { games: csvLookup(csv, settings.csv.columns, settings.csv.pathPrefix).size, counted: 'csv' };
    } catch {
      /* counted by the files below */
    }
  }
  const scan = await scanGames(platform.path, settings.extensions, [platform.imagesDir]);
  return { games: scan.files.length, counted: 'files' };
}

export async function platformSummaries(): Promise<SdPlatformsResponse> {
  const settings = await getSettings();
  if (!settings.sdRoot) return { root: '', platforms: [] };
  const platforms: PlatformSummary[] = [];
  // One folder after another: a card reader serves one request at a time anyway.
  for (const platform of await listPlatforms(settings.sdRoot)) {
    const { name, label, known } = platform;
    platforms.push({ name, label, known, ...(await countPlatformGames(platform, settings)) });
  }
  platforms.sort(compareSummaries);
  return { root: settings.sdRoot, platforms };
}
