import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { platformInfo } from '../../shared/devices.ts';
import { deviceById } from './devices/registry.ts';
import { config } from '../config/index.ts';
import { t } from '../i18n/index.ts';
import type { EmulatorGameCheck, EmulatorLaunchResponse, EmulatorStatusResponse, Settings } from '../models/index.ts';
import { BadRequestError, ForbiddenError, InternalError } from '../utils/errors.ts';
import { errorMessage } from '../utils/guards.ts';
import { safeResolveExisting, statOrNull } from '../utils/paths.ts';
import { EMULATORS, type EmulatorKind, coresFor, isPlannedFormat, supportedFormats } from './emulator/catalog.ts';
import { journal } from './journalService.ts';
import { getSettings } from './settingsService.ts';

/**
 * Starting a game in the emulator of the computer: OpenEmu on macOS, RetroArch on Windows and Linux. Desktop
 * application only (`config.desktop`); the web version neither looks for the emulator nor starts anything.
 *
 * The emulator is the path chosen in the settings when it exists, otherwise it is looked for: OpenEmu in the
 * Applications folders and by its bundle id (Spotlight); RetroArch in PATH and the usual install folders. For
 * RetroArch the core is chosen by the platform of the game and its format, among the cores that are installed.
 * The emulator runs as a separate process: the application does not wait for it.
 */

// ── The computer (replaceable in tests) ────────────────────────────────────────────────────────────

export interface EmulatorHost {
  os: NodeJS.Platform;
  home: string;
  env: NodeJS.ProcessEnv;
  /** macOS: the folders applications are installed in. */
  appDirs: string[];
  /** macOS: the path of an application found by its bundle id (Spotlight), or null. */
  findApp(bundleId: string): Promise<string | null>;
}

/** Starts a program and resolves once it is running (or has finished well); rejects with what went wrong. */
export type EmulatorSpawner = (command: string, args: string[]) => Promise<void>;

function findAppBySpotlight(bundleId: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('mdfind', [`kMDItemCFBundleIdentifier == '${bundleId}'`], { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : (stdout.split('\n').find((line) => line.endsWith('.app')) ?? null));
    });
  });
}

const systemHost = (): EmulatorHost => ({
  os: process.platform,
  home: os.homedir(),
  env: process.env,
  appDirs: ['/Applications', path.join(os.homedir(), 'Applications')],
  findApp: findAppBySpotlight,
});

/** How long a started emulator must keep running for the start to count as successful. */
const SETTLE_MS = 1500;

/**
 * Starts the emulator detached from this process. A program that fails at once (not found, no access, a bad core,
 * `open` that cannot open the file) is reported with its error output; one that is still running after a moment is
 * left alone.
 */
export const systemSpawner: EmulatorSpawner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: false });
    let stderr = '';
    let settled = false;
    const settle = (finish: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stderr?.destroy();
      child.unref();
      finish();
    };
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-2000);
    });
    child.once('error', (err) => settle(() => reject(err)));
    child.once('exit', (code, signal) =>
      settle(() => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `exit code ${code ?? signal ?? '?'}`)))),
    );
    const timer = setTimeout(() => settle(resolve), SETTLE_MS);
  });

let host: EmulatorHost = systemHost();
let spawner: EmulatorSpawner = systemSpawner;

/** Tests: a different computer (operating system, home folder, PATH…); `null` brings the real one back. */
export function setEmulatorHost(next: Partial<EmulatorHost> | null): void {
  host = next ? { ...systemHost(), ...next } : systemHost();
  located = null;
}

/** Tests: records the commands instead of starting programs; `null` brings the real starter back. */
export function setEmulatorSpawner(next: EmulatorSpawner | null): void {
  spawner = next ?? systemSpawner;
}

// ── Finding the emulator ────────────────────────────────────────────────────────────

const kindOf = (): EmulatorKind => (host.os === 'darwin' ? 'openemu' : 'retroarch');
const pathApi = (): path.PlatformPath => (host.os === 'win32' ? path.win32 : path.posix);
const exists = async (target: string): Promise<boolean> => (await statOrNull(target)) !== null;
const isFile = async (target: string): Promise<boolean> => Boolean((await statOrNull(target))?.isFile());

interface Located {
  path: string | null;
  source: 'settings' | 'auto' | null;
  settingsError: string | null;
}

/** The result of the last search, for the same settings path (the search may ask Spotlight). */
let located: { key: string; at: number; value: Located } | null = null;
const LOCATE_TTL_MS = 10_000;

async function firstExisting(candidates: string[], check: (target: string) => Promise<boolean> = exists): Promise<string | null> {
  for (const candidate of candidates) if (candidate && (await check(candidate))) return candidate;
  return null;
}

async function findOpenEmu(): Promise<string | null> {
  const found = await firstExisting(host.appDirs.map((dir) => path.posix.join(dir, 'OpenEmu.app')));
  return found ?? (await host.findApp(EMULATORS.openemu.bundleId));
}

async function findRetroArch(): Promise<string | null> {
  const p = pathApi();
  const names = host.os === 'win32' ? ['retroarch.exe'] : ['retroarch', 'org.libretro.RetroArch'];
  const fromPath = (host.env.PATH ?? host.env.Path ?? '')
    .split(p.delimiter)
    .filter(Boolean)
    .flatMap((dir) => names.map((name) => p.join(dir, name)));
  const env = host.env;
  const usual =
    host.os === 'win32'
      ? [
          env.ProgramFiles && p.join(env.ProgramFiles, 'RetroArch', 'retroarch.exe'),
          env['ProgramFiles(x86)'] && p.join(env['ProgramFiles(x86)'], 'RetroArch', 'retroarch.exe'),
          env['ProgramFiles(x86)'] && p.join(env['ProgramFiles(x86)'], 'Steam', 'steamapps', 'common', 'RetroArch', 'retroarch.exe'),
          env.ProgramFiles && p.join(env.ProgramFiles, 'Steam', 'steamapps', 'common', 'RetroArch', 'retroarch.exe'),
          'C:\\RetroArch-Win64\\retroarch.exe',
          'C:\\RetroArch\\retroarch.exe',
          env.APPDATA && p.join(env.APPDATA, 'RetroArch', 'retroarch.exe'),
          env.LOCALAPPDATA && p.join(env.LOCALAPPDATA, 'Programs', 'RetroArch', 'retroarch.exe'),
        ]
      : [
          '/usr/bin/retroarch',
          '/usr/local/bin/retroarch',
          '/snap/bin/retroarch',
          p.join(host.home, '.local', 'bin', 'retroarch'),
          '/var/lib/flatpak/exports/bin/org.libretro.RetroArch',
          p.join(host.home, '.local', 'share', 'flatpak', 'exports', 'bin', 'org.libretro.RetroArch'),
          p.join(host.home, '.steam', 'steam', 'steamapps', 'common', 'RetroArch', 'retroarch'),
        ];
  return firstExisting([...fromPath, ...usual.filter((item): item is string => Boolean(item))], isFile);
}

async function locate(settings: Settings): Promise<Located> {
  const key = `${host.os}|${settings.emulatorPath}`;
  if (located && located.key === key && Date.now() - located.at < LOCATE_TTL_MS) return located.value;
  let value: Located;
  let settingsError: string | null = null;
  if (settings.emulatorPath && (await exists(settings.emulatorPath))) {
    value = { path: settings.emulatorPath, source: 'settings', settingsError: null };
  } else {
    if (settings.emulatorPath)
      settingsError = t('The emulator chosen in the settings was not found: {path}', { path: settings.emulatorPath });
    const found = kindOf() === 'openemu' ? await findOpenEmu() : await findRetroArch();
    value = { path: found, source: found ? 'auto' : null, settingsError };
  }
  located = { key, at: Date.now(), value };
  return value;
}

// ── RetroArch cores ────────────────────────────────────────────────────────────

/** `libretro_directory` of a retroarch.cfg: `:` is the program folder, `~` the home folder; null when it is not set. */
export function coreDirFromConfig(text: string, programDir: string, home: string): string | null {
  const match = /^\s*libretro_directory\s*=\s*"([^"]*)"/m.exec(text);
  const value = match?.[1]?.trim();
  if (!value || value === 'default') return null;
  if (value.startsWith(':')) return path.join(programDir, value.slice(1));
  if (value.startsWith('~')) return path.join(home, value.slice(1));
  return value;
}

async function coreDirs(program: string): Promise<string[]> {
  const p = pathApi();
  const programDir = p.dirname(program);
  const configs =
    host.os === 'win32'
      ? [p.join(programDir, 'retroarch.cfg'), host.env.APPDATA ? p.join(host.env.APPDATA, 'RetroArch', 'retroarch.cfg') : '']
      : [
          p.join(host.home, '.config', 'retroarch', 'retroarch.cfg'),
          p.join(host.home, '.var', 'app', 'org.libretro.RetroArch', 'config', 'retroarch', 'retroarch.cfg'),
          p.join(host.home, 'snap', 'retroarch', 'current', '.config', 'retroarch', 'retroarch.cfg'),
        ];
  const dirs: string[] = [];
  for (const file of configs.filter(Boolean)) {
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    const dir = text === null ? null : coreDirFromConfig(text, programDir, host.home);
    if (dir) dirs.push(dir);
  }
  dirs.push(p.join(programDir, 'cores'));
  if (host.os !== 'win32') {
    dirs.push(
      p.join(host.home, '.config', 'retroarch', 'cores'),
      p.join(host.home, '.var', 'app', 'org.libretro.RetroArch', 'config', 'retroarch', 'cores'),
      p.join(host.home, 'snap', 'retroarch', 'current', '.config', 'retroarch', 'cores'),
      '/usr/lib/libretro',
      '/usr/lib/x86_64-linux-gnu/libretro',
      '/usr/lib/aarch64-linux-gnu/libretro',
      '/usr/lib64/libretro',
      '/usr/local/lib/libretro',
    );
  }
  return [...new Set(dirs)];
}

const coreFileName = (core: string): string => `${core}_libretro.${host.os === 'win32' ? 'dll' : host.os === 'darwin' ? 'dylib' : 'so'}`;

/** The first installed core of the list: its name and file. */
async function findCore(program: string, names: string[]): Promise<{ core: string; file: string } | null> {
  const dirs = await coreDirs(program);
  const p = pathApi();
  for (const core of names) {
    for (const dir of dirs) {
      const file = p.join(dir, coreFileName(core));
      if (await isFile(file)) return { core, file };
    }
  }
  return null;
}

// ── Checking a game ────────────────────────────────────────────────────────────

/**
 * The platform of the open games folder (the one chosen on the card, or a games folder named like a platform) in the
 * console's profile: its emulator system (FC, GBA, …) and how messages name it.
 */
function platformOf(settings: Settings): { system: string; label: string } | null {
  const folder = settings.platform || (settings.gamesDir ? path.basename(settings.gamesDir) : '');
  const info = platformInfo(deviceById(settings.device), folder);
  return info ? { system: info.system, label: `${info.folder} (${info.name})` } : null;
}

interface GamePlan extends EmulatorGameCheck {
  abs: string;
  coreFile: string | null;
}

async function planGame(settings: Settings, rel: string, emulatorPath: string | null): Promise<GamePlan> {
  const kind = kindOf();
  const name = EMULATORS[kind].name;
  const abs = await safeResolveExisting(settings.gamesDir, rel);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const no = (reason: string, note: string | null = null): GamePlan => ({
    launchable: false,
    reason,
    note,
    core: null,
    abs,
    coreFile: null,
  });

  if (!emulatorPath) return no(t('{emulator} is not installed', { emulator: name }));
  const found = platformOf(settings);
  if (!found) return no(t('The platform of the game is unknown: choose the platform folder on the SD card'));
  const platform = found.system;
  const formats = supportedFormats(kind, platform);
  if (!formats.length) return no(t('{emulator} does not support {platform}', { emulator: name, platform: found.label }));
  if (!formats.includes(ext)) {
    return no(
      t('{emulator} cannot open .{ext} files of {platform}. Supported: {formats}', {
        emulator: name,
        ext: ext || '?',
        platform: found.label,
        formats: formats.map((format) => `.${format}`).join(' '),
      }),
      isPlannedFormat(kind, platform, ext) ? t('Support for .{ext} files is coming in a future release.', { ext }) : null,
    );
  }
  if (kind === 'openemu') return { launchable: true, reason: null, note: null, core: null, abs, coreFile: null };

  const wanted = coresFor(platform, ext);
  const core = await findCore(emulatorPath, wanted);
  if (!core) {
    return no(
      t('No RetroArch core for {platform} is installed. Install one of: {cores} (RetroArch: Main Menu → Load Core → Download a Core)', {
        platform: found.label,
        cores: wanted.join(', '),
      }),
    );
  }
  return { launchable: true, reason: null, note: null, core: core.core, abs, coreFile: core.file };
}

// ── API ────────────────────────────────────────────────────────────

/** Whether the emulator is installed and, with `rel`, whether that game of the open folder can be started in it. */
export async function emulatorStatus(rel?: string): Promise<EmulatorStatusResponse> {
  const kind = kindOf();
  const base = { emulator: EMULATORS[kind].name, downloadUrl: EMULATORS[kind].downloadUrl };
  if (!config.desktop) return { ...base, enabled: false, path: null, source: null, settingsError: null, game: null };
  const settings = await getSettings();
  const found = await locate(settings);
  let game: EmulatorGameCheck | null = null;
  if (rel) {
    const plan = await planGame(settings, rel, found.path);
    game = { launchable: plan.launchable, reason: plan.reason, note: plan.note, core: plan.core };
  }
  return { ...base, enabled: true, path: found.path, source: found.source, settingsError: found.settingsError, game };
}

/** Starts a game of the open folder in the emulator. Resolves when the emulator is running. */
export async function launchGame(rel: string): Promise<EmulatorLaunchResponse> {
  if (!config.desktop) throw new ForbiddenError(t('Games can be started in an emulator only in the desktop application'));
  const kind = kindOf();
  const name = EMULATORS[kind].name;
  const settings = await getSettings();
  const found = await locate(settings);
  const plan = await planGame(settings, rel, found.path);
  if (!found.path || !plan.launchable) throw new BadRequestError(plan.reason ?? t('{emulator} is not installed', { emulator: name }));

  const [command, args] =
    kind === 'openemu'
      ? found.path.endsWith('.app')
        ? ['open', ['-a', found.path, plan.abs]]
        : [found.path, [plan.abs]]
      : [found.path, ['-L', plan.coreFile ?? '', plan.abs]];
  try {
    await spawner(command, args);
  } catch (err) {
    located = null; // the emulator may have been removed: look again next time
    const message = t('{emulator} could not be started: {message}', { emulator: name, message: errorMessage(err) });
    journal('error', message);
    throw new InternalError(message, { expose: true, cause: err });
  }
  journal('info', t('Started in {emulator}: {rel}', { emulator: name + (plan.core ? ` (${plan.core})` : ''), rel }));
  return { emulator: name, core: plan.core };
}
