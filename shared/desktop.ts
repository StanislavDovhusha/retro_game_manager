/**
 * The bridge between the web client and the desktop (Electron) shell. The preload script exposes exactly these
 * methods to the page as `window.gameManagerDesktop` (contextBridge); the main process answers the IPC channels below.
 * Types and constants only — the file is safe to import in Node, in Electron's main process and in Angular.
 */
import type { DialogFileKind } from './api.js';

/** The name of the global object the preload script creates. */
export const DESKTOP_BRIDGE_NAME = 'gameManagerDesktop';

/** IPC channels (renderer → main). `electron/preload.cjs` spells the same names; a test keeps them in sync. */
export const DESKTOP_CHANNELS = {
  pickFolder: 'desktop:pick-folder',
  pickFile: 'desktop:pick-file',
  pickFiles: 'desktop:pick-files',
} as const;

/** What the page may ask the desktop shell for. Nothing else is reachable from the page. */
export interface DesktopBridge {
  readonly isDesktop: true;
  /** The native folder picker; `null` when it was cancelled. */
  pickFolder(): Promise<string | null>;
  /** The native file picker for one file; `null` when it was cancelled. */
  pickFile(kind: DialogFileKind): Promise<string | null>;
  /** The native file picker for several game files; an empty list when it was cancelled. */
  pickFiles(kind: 'game'): Promise<string[]>;
}

/** What the main process returns over IPC: errors travel as data, so their text reaches the page unchanged. */
export type DesktopReply<T> = { ok: true; value: T } | { ok: false; message: string };
