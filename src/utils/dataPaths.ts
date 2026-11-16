import path from 'node:path';
import { config } from '../config/index.ts';

/**
 * The layout of the application data folder (`DATA_DIR`: `~/.game-manager` for the web version, the Electron
 * `userData` folder for the desktop app). Nothing of the application's own is kept on the SD card:
 *
 *   <data>/settings.json
 *   <data>/backups/<card id>/<platform folder>/   backups of filelist.csv, *.lst, cores/filelist.xml
 *   <data>/temp/                                  conversions in progress (emptied after each one and on start-up)
 *   <data>/temp/uploads/                          files dropped into the window, until the game is added
 *   <data>/logs/                                  operations.log (and the desktop app log)
 *
 * Every folder is created when it is first needed.
 */
export const dataPaths = {
  root: config.dataDir,
  backups: path.join(config.dataDir, 'backups'),
  temp: path.join(config.dataDir, 'temp'),
  uploads: path.join(config.dataDir, 'temp', 'uploads'),
  logs: path.join(config.dataDir, 'logs'),
} as const;
