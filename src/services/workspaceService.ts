import path from 'node:path';
import { t } from '../i18n/index.ts';
import type {
  PublicSettings,
  SdAccessReason,
  SdPlatformClearResponse,
  SdPlatformResponse,
  SdRootResponse,
  SdStateResponse,
  SdTree,
  SdVerifyResponse,
  Settings,
  SettingsPatch,
} from '../models/index.ts';
import { errorMessage } from '../utils/guards.ts';
import { currentOperation } from '../utils/lock.ts';
import { logger } from '../utils/logger.ts';
import { isInside } from '../utils/paths.ts';
import { migrateBackupsInBackground } from './backupService.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { detectCardDevice } from './deviceService.ts';
import { deviceById } from './devices/registry.ts';
import { checkSdAccess, SD_ACCESS_TIMEOUT_MS } from './sdAccess.ts';
import { assertSdRoot, findPlatform, listChildren, listPlatforms } from './sdCardService.ts';
import { getSettings, patchInternal, toPublicSettings, updateSettings } from './settingsService.ts';

/** Settings that decide which games are listed; changing any of them invalidates the cached scan. */
const SCAN_KEYS = ['gamesDir', 'imagesDir', 'csvPath', 'csv', 'extensions', 'device'] as const;

/** Saves a settings change made in the UI; the cached scan is dropped only when it can change the game list. */
export async function saveSettings(patch: SettingsPatch): Promise<PublicSettings> {
  const before = await getSettings();
  const settings = await updateSettings(patch);
  if (SCAN_KEYS.some((key) => JSON.stringify(before[key]) !== JSON.stringify(settings[key]))) invalidateScan();
  if (settings.gamesDir !== before.gamesDir) journal('info', t('Games folder: {gamesDir}', { gamesDir: settings.gamesDir }));
  if (settings.csvPath !== before.csvPath) journal('info', t('CSV file: {csvPath}', { csvPath: settings.csvPath }));
  if (settings.imagesDir !== before.imagesDir) journal('info', t('Images folder: {v0}', { v0: settings.imagesDir || '—' }));
  return toPublicSettings(settings);
}

/**
 * Chooses the card root. Only the root is saved: the games, images and CSV paths change when a platform is chosen.
 * The console model is recognized by the card's folders when possible; otherwise the model of the settings stays.
 */
export async function selectSdRoot(root: string): Promise<SdRootResponse> {
  await assertSdRoot(root);
  const before = await getSettings();
  const found = await detectCardDevice(root, before.device);
  const device = found?.id ?? before.device;
  // Another card: the platform and the paths of the previous one do not belong to it (the platform list opens).
  const other = path.resolve(before.sdRoot || '.') !== path.resolve(root);
  let settings = await updateSettings({ sdRoot: root, device });
  if (other && (settings.platform || settings.gamesDir || settings.imagesDir || settings.csvPath)) {
    settings = await forgetPlatform();
    invalidateScan();
  }
  journal('info', t('SD card root: {root}', { root }));
  const changed = settings.device !== before.device;
  if (changed) journal('info', t('Console model recognized by the card: {name}', { name: deviceById(settings.device).name }));
  void migrateBackupsInBackground(); // backups left on this card by older versions move to the data folder
  const detected = found ? { device: { id: settings.device, name: deviceById(settings.device).name }, changed } : null;
  return { settings: toPublicSettings(settings), platforms: await listPlatforms(root), detected };
}

/** The reason for the operations log, in the language of the request. */
function reasonText(reason: SdAccessReason, timeoutMs: number): string {
  switch (reason) {
    case 'missing':
      return t('the path was not found');
    case 'noRead':
      return t('no permission to read it');
    case 'noWrite':
      return t('no permission to write to it');
    case 'timeout':
      return t('no answer within {seconds} s', { seconds: timeoutMs / 1000 });
  }
}

/**
 * The start-up check of the saved card: the folder must exist, be readable and writable (see `sdAccess.ts`; the check
 * gives up after a few seconds). When it is not, the card is forgotten together with what belongs to it: the platform,
 * the games, images and CSV paths inside it and the image bindings to them. The other settings (language, console
 * model, panels) stay. Skipped while an operation runs: the card is in use then, and a busy card may answer slowly.
 */
export async function verifySavedSdRoot(options: { timeoutMs?: number } = {}): Promise<SdVerifyResponse> {
  const { timeoutMs = SD_ACCESS_TIMEOUT_MS } = options;
  const before = await getSettings();
  const root = before.sdRoot;
  if (!root || currentOperation()) return { settings: toPublicSettings(before), reset: null };
  const access = await checkSdAccess(root, { timeoutMs });
  const current = await getSettings();
  // Available, or another card was chosen while the check ran.
  if (access.ok || current.sdRoot !== root) return { settings: toPublicSettings(current), reset: null };
  const settings = await patchInternal((next) => {
    next.sdRoot = '';
    next.platform = '';
    for (const key of ['gamesDir', 'imagesDir', 'csvPath'] as const) {
      if (next[key] && (isInside(root, next[key]) || path.resolve(next[key]) === path.resolve(root))) next[key] = '';
    }
    if (!next.gamesDir) next.imageOverrides = {};
  });
  invalidateScan();
  const { reason, code, systemDenied } = access;
  logger.warn({ root, reason, code, systemDenied }, 'The saved SD card is not available: its selection is reset');
  journal(
    'warn',
    t('The previously selected SD card is not available ({reason}), its selection was reset: {root}', {
      reason: reasonText(reason, timeoutMs),
      root,
    }),
  );
  return { settings: toPublicSettings(settings), reset: { root, reason, systemDenied } };
}

/** The card state for the UI. An unavailable card (unplugged, folder removed) is reported, not raised. */
export async function getSdState(): Promise<SdStateResponse> {
  const { sdRoot, platform } = await getSettings();
  if (!sdRoot) return { root: '', platform: '', platforms: [], error: null };
  try {
    return { root: sdRoot, platform, platforms: await listPlatforms(sdRoot), error: null };
  } catch (err) {
    return { root: sdRoot, platform: '', platforms: [], error: errorMessage(err) };
  }
}

export async function getSdTree(rel: string): Promise<SdTree> {
  const { sdRoot } = await getSettings();
  return listChildren(sdRoot, rel);
}

/** Clears the platform with the games, images and CSV paths and the image bindings to them; the card stays. */
function forgetPlatform(): Promise<Settings> {
  return patchInternal((next) => {
    next.platform = '';
    next.gamesDir = '';
    next.imagesDir = '';
    next.csvPath = '';
    next.imageOverrides = {};
  });
}

/** "All platforms": the platform is no longer chosen, the main screen shows the platform list of the card again. */
export async function clearPlatform(): Promise<SdPlatformClearResponse> {
  const before = await getSettings();
  if (!before.platform && !before.gamesDir) return { settings: toPublicSettings(before) };
  const settings = await forgetPlatform();
  invalidateScan();
  return { settings: toPublicSettings(settings) };
}

/** Chooses a platform: the games folder, the images folder and the CSV are filled in automatically. */
export async function selectPlatform(name: string): Promise<SdPlatformResponse> {
  const before = await getSettings();
  await assertSdRoot(before.sdRoot);
  const platform = await findPlatform(before.sdRoot, name);
  const settings = await updateSettings({
    gamesDir: platform.path,
    imagesDir: platform.imagesDir,
    csvPath: platform.csvPath,
    platform: platform.name,
  });
  invalidateScan();
  journal(
    'info',
    t('Platform {name}: games — {gamesDir}, images — {imagesDir}, CSV — {csvPath}', {
      name: platform.name,
      gamesDir: platform.path,
      imagesDir: platform.imagesDir,
      csvPath: platform.csvPath,
    }),
  );
  return { settings: toPublicSettings(settings), platform, changed: before.gamesDir !== settings.gamesDir };
}
