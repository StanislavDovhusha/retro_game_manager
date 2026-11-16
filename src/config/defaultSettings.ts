import { DEFAULT_DEVICE_ID, deviceById } from '../services/devices/registry.ts';
import { AUTO_LANG } from '../../shared/constants.ts';
import { defaultDonate } from '../../shared/donate.ts';
import type { Settings } from '../models/index.ts';

/**
 * Settings of a fresh installation: the default console model, with its game list format and game formats. A new copy
 * is made for every use, so callers may mutate the result.
 */
export const createDefaultSettings = (): Settings => {
  const device = deviceById(DEFAULT_DEVICE_ID);
  return {
    device: device.id,
    gamesDir: '',
    imagesDir: '',
    csvPath: '',
    /** SD card root (optional). */
    sdRoot: '',
    /** Selected platform: the folder name on the card (SFC, GBA, PS, ...). */
    platform: '',
    csv: {
      delimiter: device.csv.delimiter,
      encoding: device.csv.encoding as Settings['csv']['encoding'],
      // Columns 1/2/3/4 of a file without a header are the path, the full title, the short title and the tags.
      hasHeader: device.csv.header,
      pathPrefix: '',
      columns: { path: '', name: '', short: '', tags: '' },
    },
    extensions: [...device.extensions],
    /** The emulator chosen by hand; empty — found automatically. */
    emulatorPath: '',
    theme: 'dark',
    ui: {
      columnWidths: {},
      hiddenPanels: { left: false, games: false, right: false },
      // Until the user chooses a language the interface follows the language of the system.
      language: AUTO_LANG,
      foldersShare: 0.5,
      donate: defaultDonate(),
      compressZip: false,
      tourDone: false,
    },
    updates: {
      checkOnStartup: true,
      lastCheckAt: 0,
      latestVersion: '',
      latestUrl: '',
      latestName: '',
      dismissedVersion: '',
    },
    lastSync: null,
    imageOverrides: {},
  };
};
