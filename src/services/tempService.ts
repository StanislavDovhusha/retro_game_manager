import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dataPaths } from '../utils/dataPaths.ts';
import { logger } from '../utils/logger.ts';

/**
 * Temporary files of conversions (ECM unpacking, BIN/CUE merging, ZIP packing) live in `<data>/temp` on the
 * computer, never on the card. Every operation gets its own folder, removed when it ends; the whole `temp` folder is
 * emptied when the application starts (whatever a crash left behind).
 */

/** Empties the temp folder (start-up). The uploads folder inside it is emptied too: uploads do not outlive a session. */
export async function initTemp(): Promise<void> {
  await fs.rm(dataPaths.temp, { recursive: true, force: true });
  await fs.mkdir(dataPaths.temp, { recursive: true });
}

/** Runs `fn` with a fresh folder inside temp and removes the folder afterwards, whatever happens. */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = path.join(dataPaths.temp, `op-${crypto.randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await fs
      .rm(dir, { recursive: true, force: true })
      .catch((err: unknown) => logger.warn({ err, dir }, 'Temp: a folder could not be removed'));
  }
}
