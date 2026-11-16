/**
 * Data models shared by the client and the server: settings, games, platforms, the journal.
 * Types only (except the constants in ./constants.ts) — the file is safe to import in both Node and Angular.
 */
import type { AUTO_LANG, COLUMN_KEYS, CSV_DELIMITERS, ENCODINGS, LANGS, LOG_LEVELS, THEMES } from './constants.js';
import type { DonateSettings } from './donate.js';

// ── Simple enumerations ────────────────────────────────────────────────────────────
export type Lang = (typeof LANGS)[number];
/** The stored language: a chosen one, or `auto` (the language of the system) until the user chooses. */
export type LangSetting = Lang | typeof AUTO_LANG;
export type Theme = (typeof THEMES)[number];
export type CsvEncoding = (typeof ENCODINGS)[number];
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];
export type ColumnKey = (typeof COLUMN_KEYS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

// ── Settings ────────────────────────────────────────────────────────────
/** Names of the CSV columns (for a CSV with a header); an empty string means the default column. */
export interface CsvColumnNames {
  path: string;
  name: string;
  short: string;
  /** Column with the tags (for a CSV with a header); by default the 4th column. */
  tags: string;
}

export interface CsvSettings {
  delimiter: CsvDelimiter;
  encoding: CsvEncoding;
  hasHeader: boolean;
  pathPrefix: string;
  columns: CsvColumnNames;
}

export interface UiSettings {
  columnWidths: Partial<Record<ColumnKey, number>>;
  /**
   * Side panels: `games` — the "All games" panel inside the left column is collapsed, `right` — "Details" is hidden.
   * (`left` is not used any more: the left column is always shown.)
   */
  hiddenPanels: { left: boolean; games: boolean; right: boolean };
  /** The share of the left column's height taken by the "Folders" panel (the rest is "All games"). */
  foldersShare: number;
  language: LangSetting;
  /** The "Support the project" popup: counter, threshold and the automatic-show switch. */
  donate: DonateSettings;
  /** The "Compress to .zip" checkbox of the "Add game" dialog: remembered between additions. */
  compressZip: boolean;
  /** The start-up tour was finished or skipped: it is not shown by itself any more ("Restart tour" in the settings). */
  tourDone: boolean;
}

export interface SyncReportOk {
  ok: true;
  at: number;
  toAdd: number;
  toRemove: number;
  unchanged: number;
  unmanaged: number;
  duplicates: number;
  /** true — the CSV did not exist (or was empty) and was created from the games in the folder. */
  created: boolean;
  /** Rows that got the empty 4th (tags) column they were missing. */
  tagsColumnAdded: number;
  backupPath: string | null;
  /**
   * The console's game lists (`*.lst`) brought in line with the files of the platform: lines added, removed and
   * updated (an extension change), and what could not be done. null — no card platform is open (no lists).
   */
  lists?: { added: number; removed: number; updated: number; warnings: string[]; errors?: string[] } | null;
}
export interface SyncReportFailed {
  ok: false;
  at: number;
  error: string;
}
export type SyncReport = SyncReportOk | SyncReportFailed;

/** The check for a newer version of the application (GitHub releases). */
export interface UpdateSettings {
  /** Check when the application starts, at most once a day. "Check now" in the settings works either way. */
  checkOnStartup: boolean;
  /** When GitHub last answered a check (ms since 1970); 0 — never. A failed check does not count. */
  lastCheckAt: number;
  /** The newest release found by that check ('' — none, or its tag could not be read). */
  latestVersion: string;
  /** Its page on GitHub. */
  latestUrl: string;
  /** Its title. */
  latestName: string;
  /** The notice of this version was closed: it shows again only for a newer one ('' — none closed). */
  dismissedVersion: string;
}

/** Settings as the client sees them. */
export interface PublicSettings {
  /** The console model (the id of a profile in `devices/`): platforms, system folders, list format, tips. */
  device: string;
  gamesDir: string;
  imagesDir: string;
  csvPath: string;
  /** Root of the memory card (optional). */
  sdRoot: string;
  /** The selected platform — the name of the folder on the card (SFC, GBA, PS, …). */
  platform: string;
  csv: CsvSettings;
  extensions: string[];
  /**
   * The emulator chosen by hand: OpenEmu.app on macOS, the RetroArch program on Windows and Linux.
   * '' — it is looked for automatically.
   */
  emulatorPath: string;
  theme: Theme;
  ui: UiSettings;
  updates: UpdateSettings;
  lastSync: SyncReport | null;
}

// ── Games and the library ────────────────────────────────────────────────────────────
export interface GameFile {
  /** Path relative to the games folder (always with "/"). */
  rel: string;
  abs: string;
  /** File name without the extension. */
  name: string;
  fileName: string;
  ext: string;
  /** Folder of the file relative to the games folder ('' — the root). */
  dir: string;
  size: number;
  mtime: number;
}

export type ImageSource = 'manual' | 'auto';

/** A game in the library: the file + the data from the CSV and the image that was found. */
export interface LibraryFile extends GameFile {
  /** Display title: from the CSV (column 2) or the file name without the extension. */
  title: string;
  csvName: string | null;
  csvShort: string | null;
  /** Tags from the 4th CSV column (empty when there is none). */
  tags: string[];
  hasImage: boolean;
  imageSource: ImageSource | null;
  imageName: string | null;
  imageAbs: string | null;
  /** null — the CSV is not configured or could not be read. */
  inCsv: boolean | null;
}

export interface ScanError {
  path: string;
  message: string;
}

export interface Library {
  gamesDir: { path: string; exists: boolean; error: string | null };
  imagesDir: { path: string | null; isDefault: boolean };
  files: LibraryFile[];
  dirs: string[];
  errors: ScanError[];
  csv: { configured: boolean; ok: boolean; exists: boolean; error: string | null; rows: number };
  counts: {
    games: number;
    csvEntries: number;
    inCsv: number;
    missingInCsv: number;
    withImage: number;
    totalSize: number;
  };
  scannedAt: number;
  durationMs: number;
}

// ── Memory card ────────────────────────────────────────────────────────────
/** A games folder of the card (a platform) and the paths found for it. */
export interface Platform {
  /** The real folder name on the card (SFC, GBA, roms, …). */
  name: string;
  /** The full platform name from `shared/platforms.ts`, or null for a folder that is not in the directory. */
  label: string | null;
  known: boolean;
  path: string;
  imagesDir: string;
  csvPath: string;
  imagesExist: boolean;
  csvExists: boolean;
}

export type SdNodeKind = 'platform' | 'system' | 'media' | 'junk' | 'folder';
export interface SdNode {
  name: string;
  rel: string;
  kind: SdNodeKind;
  hasChildren: boolean;
  /** The full name of a platform folder in the console's profile (`SFC` → Super Nintendo (SNES)); null otherwise. */
  label: string | null;
}
export interface SdTree {
  rel: string;
  nodes: SdNode[];
  truncated: boolean;
}

// ── Global search ────────────────────────────────────────────────────────────
/** A game of one of the platform folders of the card, as the global search sees it. */
export interface SearchGame {
  /** The platform folder on the card to open; '' when no card is chosen (the games folder that is open). */
  platform: string;
  /** The folder shown next to the game: the platform folder, or the name of the games folder without a card. */
  folder: string;
  /** The full name of the platform in the console's profile (`Super Nintendo (SNES)`), or null for another folder. */
  platformName: string | null;
  /** Path relative to the platform folder (the `rel` of the game in the library of that platform). */
  rel: string;
  fileName: string;
  /** The CSV title, or the file name without the extension. */
  title: string;
  /** Short title from the CSV ('' when there is none). */
  short: string;
  tags: string[];
}

/** Every game of every platform folder of the card (system and media folders are not included). */
export interface SearchIndex {
  /** The card root ('' — no card: only the games folder that is open). */
  root: string;
  games: SearchGame[];
  /** Platform folders (or their CSV files) that could not be read: their games are missing or have no titles. */
  errors: { folder: string; message: string }[];
  builtAt: number;
}

// ── Journal ────────────────────────────────────────────────────────────
export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

// ── Adding a game ────────────────────────────────────────────────────────────
export type FileKind = 'game' | 'image';
/** A file source: a path on disk (system dialog) or a file uploaded from the browser (drag and drop). */
export type SourceRef = { type: 'path'; path: string } | { type: 'upload'; id: string };
/**
 * What the selected game files become: `single` — one file copied as it is; `disc` — a .cue with its .bin files
 * merged into one .img; `clonecd` — the .img of a CloneCD set (.ccd + .img + .sub); `ecm` — an ECM archive unpacked.
 */
export type PlanMode = 'single' | 'disc' | 'clonecd' | 'ecm';
/** A stage of adding a game that the server reports while it works. */
export type AddPhase = 'copying' | 'unpacking' | 'building' | 'compressing';
