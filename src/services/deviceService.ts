import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeviceProfile } from '../../shared/devices.ts';
import type { CsvReadOptions, DevicesResponse, Settings } from '../models/index.ts';
import { deviceById, detectDevice, listDevices } from './devices/registry.ts';
import { getSettings } from './settingsService.ts';
import { t } from '../i18n/index.ts';
import { BadRequestError } from '../utils/errors.ts';

/** The profile of the model chosen in the settings. */
export async function activeDevice(): Promise<DeviceProfile> {
  return deviceById((await getSettings()).device);
}

/** The models for the settings, and the active profile for the interface (platform names, tips, file names). */
export async function devicesResponse(): Promise<DevicesResponse> {
  return { devices: listDevices(), active: await activeDevice() };
}

/**
 * The model of a card from the folders and files of its root; null when no profile recognizes it. Models with the
 * same card layout cannot be told apart: then the one chosen in the settings is kept (see `detectDevice`).
 */
export async function detectCardDevice(root: string, preferred: string): Promise<ReturnType<typeof detectDevice>> {
  let names: string[];
  try {
    names = await fs.readdir(root);
  } catch {
    return null;
  }
  return detectDevice(new Set(names.map((name) => name.toLowerCase())), preferred);
}

/** How to read the game list of the settings; a list that does not exist yet is created in the console's format. */
export function csvReadOptions(settings: Settings): CsvReadOptions {
  const { csv } = deviceById(settings.device);
  return { ...settings.csv, newFile: { bom: csv.bom, eol: csv.lineEnding === 'crlf' ? '\r\n' : '\n' } };
}

/**
 * The games folder must not be a media folder of the card (`Ebook`, `Photo`, `BGM`, `Music`, `Movie`; any letter case):
 * those are not game folders, so no game is added there and no filelist.csv is created there.
 */
export function assertNotMediaFolder(settings: Settings): void {
  if (!settings.sdRoot || !settings.gamesDir) return;
  const dir = path.resolve(settings.gamesDir);
  if (path.dirname(dir).toLowerCase() !== path.resolve(settings.sdRoot).toLowerCase()) return;
  const folder = path.basename(dir);
  if (deviceById(settings.device).folders.media.some((name) => name.toLowerCase() === folder.toLowerCase())) {
    throw new BadRequestError(t('{folder} is a media folder, not a game folder: no games or filelist.csv are added there', { folder }));
  }
}
