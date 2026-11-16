import semver from 'semver';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AUTO_LANG, COLUMN_KEYS } from '../../shared/constants.ts';
import { normalizeDonate } from '../../shared/donate.ts';
import { config } from '../config/index.ts';
import { createDefaultSettings } from '../config/defaultSettings.ts';
import { DEFAULT_DEVICE_ID, isDeviceId } from './devices/registry.ts';
import { isLang, t } from '../i18n/index.ts';
import type { PublicSettings, Settings, SettingsPatch } from '../models/index.ts';
import { atomicWrite } from '../utils/atomicWrite.ts';
import { BadRequestError } from '../utils/errors.ts';
import { isRecord } from '../utils/guards.ts';
import type { UnknownRecord } from '../utils/guards.ts';
import { assertAbsoluteInside, assertDirectory, assertNotProtected, statOrNull } from '../utils/paths.ts';

const SETTINGS_FILE = path.join(config.dataDir, 'settings.json');

let cache: Settings | null = null;

/** The share of the left column taken by the Folders panel: a number from 0.1 to 0.9 (a damaged value means half). */
const clampShare = (value: unknown): number => {
  const share = typeof value === 'number' && Number.isFinite(value) ? value : 0.5;
  return Math.round(Math.min(0.9, Math.max(0.1, share)) * 1000) / 1000;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Deep merge: values of `patch` replace values of `base`; nested objects are merged. */
function merge<T extends object>(base: T, patch: unknown): T {
  const baseRecord: UnknownRecord = Object.fromEntries(Object.entries(base));
  const out: UnknownRecord = { ...baseRecord };
  if (isRecord(patch)) {
    for (const [key, value] of Object.entries(patch)) {
      const current = baseRecord[key];
      out[key] = isRecord(value) && isRecord(current) ? merge(current, value) : value;
    }
  }
  return out as T;
}

/** Settings as the client sees them: without the internal image bindings. */
export function toPublicSettings(settings: Settings): PublicSettings {
  const { imageOverrides: _internal, ...publicPart } = settings;
  return publicPart;
}

export async function getSettings(): Promise<Settings> {
  if (cache) return clone(cache);
  try {
    const raw: unknown = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    cache = merge(createDefaultSettings(), raw);
  } catch {
    cache = createDefaultSettings();
  }
  return clone(cache);
}

async function persist(settings: Settings): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await atomicWrite(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  cache = clone(settings);
}

/**
 * Applies a settings change that comes from the UI. The patch is already shape-checked by the request schema;
 * what is checked here are the rules that need the disk and the current settings: system folders, existence,
 * and "inside the SD card root" when a card is selected.
 */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  const current = await getSettings();
  const next = merge(current, patch);

  // The rootfs and cubegm folders cannot be chosen as the games, images or CSV location.
  for (const key of ['gamesDir', 'imagesDir', 'csvPath'] as const) {
    if (patch[key]) assertNotProtected(next[key]);
  }

  // Client-supplied absolute paths: with an SD card selected, everything must stay inside its root.
  if (patch.sdRoot) assertAbsoluteInside(next.sdRoot, null, t('SD card root'));
  const root = next.sdRoot || null;
  if (patch.gamesDir) next.gamesDir = assertAbsoluteInside(next.gamesDir, root, t('Games folder'));
  if (patch.imagesDir) next.imagesDir = assertAbsoluteInside(next.imagesDir, root, t('Images folder'));
  if (patch.csvPath) next.csvPath = assertAbsoluteInside(next.csvPath, root, t('CSV file'));

  if (patch.sdRoot) await assertDirectory(next.sdRoot, t('SD card root'));
  if (patch.gamesDir) await assertDirectory(next.gamesDir, t('Games folder'));
  if (patch.imagesDir) {
    // The images folder may not exist yet (for example <games>/images), but it must not be a file.
    const st = await statOrNull(next.imagesDir);
    if (st && !st.isDirectory()) {
      throw new BadRequestError(t('Images folder: this is a file, not a folder — {imagesDir}', { imagesDir: next.imagesDir }));
    }
  }
  if (patch.csvPath) {
    // The CSV may not exist yet (it is created on sync), but its folder must be reachable.
    const st = await statOrNull(next.csvPath);
    if (st && !st.isFile()) {
      throw new BadRequestError(t('CSV file: the path is not a file — {csvPath}', { csvPath: next.csvPath }));
    }
    if (!st) await assertDirectory(path.dirname(next.csvPath), t('CSV file folder'));
  }

  // The emulator chosen by hand must exist (an application bundle on macOS is a folder, a program elsewhere is a file).
  if (patch.emulatorPath !== undefined) {
    next.emulatorPath = next.emulatorPath.trim();
    if (next.emulatorPath) {
      next.emulatorPath = assertAbsoluteInside(next.emulatorPath, null, t('Emulator'));
      if (!(await statOrNull(next.emulatorPath))) {
        throw new BadRequestError(t('Emulator: the path does not exist — {path}', { path: next.emulatorPath }));
      }
    }
  }

  next.extensions = [...new Set(next.extensions.map((ext) => ext.trim().replace(/^\./, '').toLowerCase()).filter(Boolean))];

  // Column widths: only known columns, whole numbers in a sane range.
  const widths: Settings['ui']['columnWidths'] = {};
  for (const key of COLUMN_KEYS) {
    const value = Number(next.ui.columnWidths[key]);
    if (Number.isFinite(value)) widths[key] = Math.round(Math.min(2000, Math.max(40, value)));
  }
  next.ui = {
    columnWidths: widths,
    hiddenPanels: {
      left: Boolean(next.ui.hiddenPanels.left),
      games: Boolean(next.ui.hiddenPanels.games),
      right: Boolean(next.ui.hiddenPanels.right),
    },
    language: isLang(next.ui.language) ? next.ui.language : AUTO_LANG,
    foldersShare: clampShare(next.ui.foldersShare),
    donate: normalizeDonate(next.ui.donate),
    compressZip: next.ui.compressZip === true,
    tourDone: next.ui.tourDone === true,
  };

  // The console model: an unknown id (a removed profile) falls back to the default model.
  if (!isDeviceId(next.device)) next.device = DEFAULT_DEVICE_ID;

  // The update check: the switch and the closed notice (a version, or nothing); the rest is written by the check itself.
  next.updates = {
    ...next.updates,
    checkOnStartup: next.updates.checkOnStartup !== false,
    dismissedVersion: semver.valid(next.updates.dismissedVersion) ?? '',
  };

  // A platform is valid only while the games folder is <SD root>/<platform>.
  if (next.platform && !(next.sdRoot && path.resolve(next.gamesDir || '.') === path.resolve(next.sdRoot, next.platform))) {
    next.platform = '';
  }

  // A different games folder makes the manual image bindings to the old paths obsolete.
  if (patch.gamesDir && next.gamesDir !== current.gamesDir) next.imageOverrides = {};

  await persist(next);
  return clone(next);
}

/** Internal changes (not from the UI): image bindings, the result of the last sync. */
export async function patchInternal(fn: (settings: Settings) => Settings | void): Promise<Settings> {
  const current = await getSettings();
  const next = fn(current) ?? current;
  await persist(next);
  return clone(next);
}
