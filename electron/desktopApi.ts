import { DESKTOP_CHANNELS } from '../shared/desktop.ts';
import type { DesktopReply } from '../shared/desktop.ts';
import type { DialogFileKind } from '../shared/api.ts';

/** What the desktop API needs from the application. The services are passed in, so this file needs no Electron. */
export interface DesktopApiDeps {
  pickFolder(): Promise<string | null>;
  pickFile(kind: DialogFileKind): Promise<string | null>;
  pickFiles(kind: DialogFileKind): Promise<string[]>;
  /** Runs `task` in the language chosen in the settings (dialog titles and messages are translated). */
  inUserLanguage<T>(task: () => Promise<T>): Promise<T>;
}

export type DesktopChannel = (typeof DESKTOP_CHANNELS)[keyof typeof DESKTOP_CHANNELS];
export type DesktopHandler = (...args: unknown[]) => Promise<DesktopReply<unknown>>;

const FILE_KINDS: readonly string[] = ['csv', 'image', 'game', 'emulator'];
const isFileKind = (value: unknown): value is DialogFileKind => typeof value === 'string' && FILE_KINDS.includes(value);

const messageOf = (err: unknown): string => (err instanceof Error && err.message ? err.message : 'The desktop request failed');

/**
 * The handlers of the IPC channels, one per method of the bridge. Arguments come from the page, so they are
 * checked here; a failure is returned as data (`{ ok: false, message }`), never thrown across the process border.
 */
export function createDesktopHandlers(deps: DesktopApiDeps): Record<DesktopChannel, DesktopHandler> {
  const reply = async <T>(task: () => Promise<T>): Promise<DesktopReply<T>> => {
    try {
      return { ok: true, value: await deps.inUserLanguage(task) };
    } catch (err) {
      return { ok: false, message: messageOf(err) };
    }
  };
  const invalid = (what: string): Promise<DesktopReply<never>> => Promise.resolve({ ok: false, message: `Invalid argument: ${what}` });

  return {
    [DESKTOP_CHANNELS.pickFolder]: () => reply(() => deps.pickFolder()),
    [DESKTOP_CHANNELS.pickFile]: (kind) => (isFileKind(kind) ? reply(() => deps.pickFile(kind)) : invalid('file kind')),
    // Several files can only be chosen for games.
    [DESKTOP_CHANNELS.pickFiles]: (kind) => (kind === 'game' ? reply(() => deps.pickFiles(kind)) : invalid('file kind')),
  };
}
