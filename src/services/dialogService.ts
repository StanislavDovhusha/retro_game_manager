import { execFile } from 'node:child_process';
import { IMAGE_EXTENSIONS } from '../../shared/constants.ts';
import { DISC_SET_EXTENSIONS } from '../../shared/discSet.ts';
import { t } from '../i18n/index.ts';
import type { DialogFileKind } from '../models/index.ts';
import { AppError, InternalError, NotImplementedError, ValidationError } from '../utils/errors.ts';
import { errorMessage, isErrnoException } from '../utils/guards.ts';
import { suggestSdFolder } from '../utils/mountPoints.ts';

/** What a native "open" dialog is asked to show (the shape of Electron's `dialog.showOpenDialog` options). */
export interface NativeOpenDialogOptions {
  title: string;
  /** The folder the dialog opens in; the system decides when absent. */
  defaultPath?: string;
  properties: ('openFile' | 'openDirectory' | 'multiSelections')[];
  filters: { name: string; extensions: string[] }[];
}

/** Shows a native dialog and returns the chosen paths (an empty list when it was cancelled). */
export type NativeOpenDialog = (options: NativeOpenDialogOptions) => Promise<string[]>;

let nativeDialog: NativeOpenDialog | null = null;

/**
 * Lets the host application supply the dialog. The desktop app registers Electron's `dialog.showOpenDialog`;
 * without a provider (browser mode) the dialogs are opened through the operating system's own tools.
 */
export const setNativeOpenDialog = (provider: NativeOpenDialog | null): void => {
  nativeDialog = provider;
};

const ALL_FILES = (): { name: string; extensions: string[] } => ({ name: t('All files'), extensions: ['*'] });
const safeExtensions = (extensions: string[]): string[] => extensions.filter((ext) => /^[a-z0-9]{1,12}$/i.test(ext));
/** Game extensions for the "Games" filter, plus the parts of disc image sets (.cue, .ccd, .sub, .ecm…) that are added together. */
const gameExtensions = (extensions: string[]): string[] =>
  extensions.length ? [...new Set([...safeExtensions(extensions), ...DISC_SET_EXTENSIONS])] : [];

/** Filters of the native dialog. For games the extension list comes from the settings (safe characters only). */
function nativeFilters(kind: DialogFileKind, extensions: string[]): NativeOpenDialogOptions['filters'] {
  if (kind === 'csv') return [{ name: t('CSV and text files'), extensions: ['csv', 'txt'] }, ALL_FILES()];
  if (kind === 'image') return [{ name: t('Images'), extensions: [...IMAGE_EXTENSIONS] }, ALL_FILES()];
  if (kind === 'emulator') {
    // OpenEmu.app on macOS (an application bundle is picked like a file), retroarch.exe on Windows, any program on Linux.
    if (process.platform === 'darwin') return [{ name: t('Applications'), extensions: ['app'] }];
    if (process.platform === 'win32') return [{ name: t('Programs'), extensions: ['exe'] }, ALL_FILES()];
    return [ALL_FILES()];
  }
  const games = gameExtensions(extensions);
  return games.length ? [{ name: t('Games'), extensions: games }, ALL_FILES()] : [ALL_FILES()];
}

/** A trailing separator is dropped (`/mnt/card/` → `/mnt/card`), a root (`/`, `E:\`) is kept as it is. */
const withoutTrailingSeparator = (value: string): string => (/^(?:[a-zA-Z]:)?[\\/]$/.test(value) ? value : value.replace(/[\\/]+$/, ''));

/** An error from starting an external program; `missing` means the program is not installed. */
type RunError = Error & { missing?: boolean };

interface DialogFilter {
  win: string;
  mac: string | null;
  zenity: string[];
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: false, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) {
        if (isErrnoException(err) && err.code === 'ENOENT') return reject(Object.assign(err, { missing: true }));
        // Exit code 1 of zenity/kdialog/osascript means the user pressed "Cancel".
        if (typeof err.code === 'number') return resolve('');
        return reject(err);
      }
      resolve(stdout.replace(/[\r\n]+$/, ''));
    });
  });
}

const PS_PREFIX =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8;Add-Type -AssemblyName System.Windows.Forms;' +
  '$top=New-Object System.Windows.Forms.Form;$top.TopMost=$true;';

// The filter captions depend on the request language, so they are built on each call, not when the module loads.
const ps = (text: string): string => String(text).replace(/'/g, "''"); // escaping for a PowerShell single-quoted string
const FILTERS = (): Record<'csv' | 'image' | 'emulator', { win: string; mac: string; zenity: string }> => ({
  csv: { win: `${t('CSV and text files')}|*.csv;*.txt|${t('All files')}|*.*`, mac: '{"csv","txt"}', zenity: '*.csv *.txt *.CSV' },
  image: {
    win: `${t('Images')}|*.png;*.jpg;*.jpeg;*.bmp;*.gif;*.webp|${t('All files')}|*.*`,
    mac: '{"public.image"}',
    zenity: '*.png *.jpg *.jpeg *.bmp *.gif *.webp',
  },
  emulator: { win: `${t('Programs')}|*.exe|${t('All files')}|*.*`, mac: '{"com.apple.application-bundle"}', zenity: '*' },
});

const isMissing = (err: unknown): boolean => err instanceof Error && (err as RunError).missing === true;

function dialogError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isMissing(err)) {
    return new NotImplementedError(t('The system dialog is unavailable (install zenity or kdialog). Enter the path manually.'));
  }
  return new InternalError(t('Could not open the system dialog: {message}', { message: errorMessage(err) }), { cause: err });
}

/** Opens the system folder picker. Returns the path, or null when cancelled. */
export async function pickFolder(): Promise<string | null> {
  if (nativeDialog) {
    const [picked] = await nativeDialog({
      title: t('Choose a folder'),
      defaultPath: await suggestSdFolder(),
      properties: ['openDirectory'],
      filters: [],
    });
    return picked ? withoutTrailingSeparator(picked) : null;
  }
  try {
    let out: string;
    if (process.platform === 'win32') {
      out = await run('powershell.exe', [
        '-NoProfile',
        '-STA',
        '-Command',
        PS_PREFIX +
          `$d=New-Object System.Windows.Forms.FolderBrowserDialog;$d.Description='${ps(t('Choose a folder'))}';` +
          "if($d.ShowDialog($top) -eq 'OK'){$d.SelectedPath}",
      ]);
    } else if (process.platform === 'darwin') {
      out = await run('osascript', ['-e', `POSIX path of (choose folder with prompt "${t('Choose a folder')}")`]);
    } else {
      try {
        out = await run('zenity', ['--file-selection', '--directory', `--title=${t('Choose a folder')}`]);
      } catch (err) {
        if (!isMissing(err)) throw err;
        out = await run('kdialog', ['--getexistingdirectory', process.env.HOME || '/']);
      }
    }
    return out ? out.replace(/(.)\/$/, '$1') : null;
  } catch (err) {
    throw dialogError(err);
  }
}

/** Dialog filters. For games the extension list comes from the settings (safe characters only). */
function filterFor(kind: DialogFileKind, exts: string[] = []): DialogFilter {
  if (kind === 'game') {
    const patterns = gameExtensions(exts).map((ext) => `*.${ext}`);
    return {
      win: patterns.length ? `${t('Games')}|${patterns.join(';')}|${t('All files')}|*.*` : `${t('All files')}|*.*`,
      mac: null,
      zenity: patterns.length ? [`--file-filter=${t('Games')} | ${patterns.join(' ')}`, `--file-filter=${t('All files')} | *`] : [],
    };
  }
  const filter = FILTERS()[kind];
  return { ...filter, zenity: [`--file-filter=${filter.zenity}`] };
}

const SEP = '\u001f'; // zenity's name separator: it never occurs in file names

/**
 * The system file picker. `kind`: 'csv' | 'image' | 'game' | 'emulator'.
 * `multiple: true` allows several files; the result is an array of paths (empty when cancelled).
 */
export async function pickFile(kind: DialogFileKind, extensions: string[], multiple: true): Promise<string[]>;
export async function pickFile(kind: DialogFileKind, extensions?: string[], multiple?: false): Promise<string | null>;
export async function pickFile(kind: DialogFileKind, extensions: string[] = [], multiple = false): Promise<string | string[] | null> {
  if (kind !== 'csv' && kind !== 'image' && kind !== 'game' && kind !== 'emulator') throw new ValidationError(t('Unknown file type'));
  if (nativeDialog) {
    const picked = await nativeDialog({
      title: multiple ? t('Choose files') : t('Choose a file'),
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: nativeFilters(kind, extensions),
    });
    return multiple ? picked : (picked[0] ?? null);
  }
  const filter = filterFor(kind, extensions);
  try {
    let out: string;
    if (process.platform === 'win32') {
      out = await run('powershell.exe', [
        '-NoProfile',
        '-STA',
        '-Command',
        PS_PREFIX +
          `$d=New-Object System.Windows.Forms.OpenFileDialog;$d.Filter='${ps(filter.win)}';$d.Multiselect=$${multiple};` +
          `if($d.ShowDialog($top) -eq 'OK'){${multiple ? '$d.FileNames' : '$d.FileName'}}`,
      ]);
    } else if (process.platform === 'darwin') {
      const type = filter.mac ? ` of type ${filter.mac}` : '';
      out = multiple
        ? await run('osascript', [
            '-e',
            `set theFiles to choose file with prompt "${t('Choose files')}"${type} with multiple selections allowed`,
            '-e',
            'set out to ""',
            '-e',
            'repeat with f in theFiles',
            '-e',
            'set out to out & POSIX path of f & linefeed',
            '-e',
            'end repeat',
            '-e',
            'return out',
          ])
        : await run('osascript', ['-e', `POSIX path of (choose file with prompt "${t('Choose a file')}"${type})`]);
    } else {
      try {
        out = await run('zenity', [
          '--file-selection',
          ...filter.zenity,
          ...(multiple ? ['--multiple', `--separator=${SEP}`] : []),
          `--title=${t('Choose a file')}`,
        ]);
      } catch (err) {
        if (!isMissing(err)) throw err;
        out = await run('kdialog', [
          '--getopenfilename',
          process.env.HOME || '/',
          ...(multiple ? ['--multiple', '--separate-output'] : []),
        ]);
      }
    }
    if (!multiple) return out || null;
    return (out || '').split(new RegExp(`[${SEP}\\r\\n]+`)).filter(Boolean);
  } catch (err) {
    throw dialogError(err);
  }
}
