/**
 * Must be the FIRST import of every test file: it points the application at a throw-away data folder and silences
 * the logger before any `src/` module reads the configuration. Tests never touch a real SD card or the real
 * data folder. (Every test file runs in its own process, so the environment is not shared.)
 */
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** A fresh temporary working folder of this test file. Contains `data/` (app data) and whatever the test creates. */
export const work = fsSync.mkdtempSync(path.join(os.tmpdir(), 'game-manager-test-'));

process.env.DATA_DIR = path.join(work, 'data');
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV ??= 'test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

process.once('exit', () => {
  fsSync.rmSync(work, { recursive: true, force: true });
});
