/**
 * REST API contract (/api/*): request and response bodies.
 * The server reports errors as `{ error, code }` with an HTTP status of 4xx/5xx; `error` is a human-readable
 * message, `code` is a stable machine-readable identifier (VALIDATION_ERROR, NOT_FOUND, ...).
 */
import type {
  CsvColumnNames,
  CsvSettings,
  FileKind,
  Library,
  LogEntry,
  Platform,
  AddPhase,
  PlanMode,
  PublicSettings,
  SdTree,
  SearchIndex,
  SourceRef,
  SyncReport,
  Theme,
  UiSettings,
  UpdateSettings,
} from './models.js';
import type { DeviceProfile, DeviceSummary } from './devices.js';

export interface ErrorResponse {
  error: string;
  /** Stable error code, for example VALIDATION_ERROR, NOT_FOUND, CONFLICT, PATH_OUTSIDE_ROOT. */
  code: string;
  /** Extra data, for example the list of invalid fields. */
  details?: unknown;
  /** The stack trace: present only outside production. */
  stack?: string;
}

// ── Settings ────────────────────────────────────────────────────────────
/** A settings change: any of the listed fields; nested objects are merged with the current ones. */
export interface SettingsPatch {
  device?: string;
  gamesDir?: string;
  imagesDir?: string;
  csvPath?: string;
  sdRoot?: string;
  platform?: string;
  csv?: Partial<Omit<CsvSettings, 'columns'>> & { columns?: Partial<CsvColumnNames> };
  extensions?: string[];
  emulatorPath?: string;
  theme?: Theme;
  /** Only the switch and the closed notice come from the UI; the results of the checks are written by the server. */
  updates?: Partial<Pick<UpdateSettings, 'checkOnStartup' | 'dismissedVersion'>>;
  ui?: Partial<Omit<UiSettings, 'hiddenPanels' | 'donate'>> & {
    hiddenPanels?: Partial<UiSettings['hiddenPanels']>;
    donate?: Partial<UiSettings['donate']>;
  };
}
export interface SettingsResponse {
  settings: PublicSettings;
  encodings: readonly string[];
}
export interface SettingsSavedResponse {
  settings: PublicSettings;
}

// ── System dialogs ────────────────────────────────────────────────────────────
/** `emulator` — OpenEmu.app on macOS, the RetroArch program elsewhere. */
export type DialogFileKind = 'csv' | 'emulator' | FileKind;
export interface PickFileRequest {
  kind: DialogFileKind;
  multiple?: boolean;
}
/** path === null — the dialog was closed without a choice. */
export interface PathResponse {
  path: string | null;
}
export interface PathsResponse {
  paths: string[];
}

// ── Memory card ────────────────────────────────────────────────────────────
export interface SdStateResponse {
  root: string;
  platform: string;
  platforms: Platform[];
  /** Why the card is unavailable (removed, folder deleted). */
  error: string | null;
}
/**
 * Why the saved card folder cannot be used: `missing` — the path is gone (card removed, another drive letter, folder
 * renamed), `noRead` / `noWrite` — no permission, `timeout` — the drive did not answer in time.
 */
export type SdAccessReason = 'missing' | 'noRead' | 'noWrite' | 'timeout';
/** The start-up check of the saved card (`POST /api/sd/verify`). */
export interface SdVerifyResponse {
  settings: PublicSettings;
  /**
   * null — the card is available (or none is saved). Otherwise the card selection and what depends on it (platform,
   * games, images and CSV paths) were reset; `systemDenied` — macOS refused the access in its privacy settings.
   */
  reset: { root: string; reason: SdAccessReason; systemDenied: boolean } | null;
}
export interface SdRootRequest {
  root: string;
}
export interface SdRootResponse {
  settings: PublicSettings;
  platforms: Platform[];
  /**
   * The model recognized by the card's folders (null: not recognized, the model of the settings stays). `changed` —
   * the settings now use it.
   */
  detected: { device: DeviceSummary; changed: boolean } | null;
}
/** A platform folder of the card for the platform list of the main screen. */
export interface PlatformSummary {
  /** The folder name on the card (SFC). */
  name: string;
  /** The full name from the console's profile (Super Nintendo (SNES)), or null for a folder the profile does not know. */
  label: string | null;
  known: boolean;
  /** Games in the platform's CSV, or game files in the folder when there is no CSV (or it cannot be read). */
  games: number;
  counted: 'csv' | 'files';
}
/** `GET /api/sd/platforms`: the platform folders sorted by their full name (system and media folders are left out). */
export interface SdPlatformsResponse {
  root: string;
  platforms: PlatformSummary[];
}
/** `DELETE /api/sd/platform`: back to the platform list (the games, images and CSV paths are cleared). */
export interface SdPlatformClearResponse {
  settings: PublicSettings;
}
export interface SdPlatformRequest {
  name: string;
}
export interface SdPlatformResponse {
  settings: PublicSettings;
  platform: Platform;
  /** true — the games folder has changed. */
  changed: boolean;
}
export type SdTreeResponse = SdTree;

// ── Library, status, journal ────────────────────────────────────────────────────────────
export type LibraryResponse = Library;
export interface StatusResponse {
  /** Name of the running operation, or null. */
  busy: string | null;
}
export interface LogResponse {
  entries: LogEntry[];
}

// ── Emulator (desktop application only) ────────────────────────────────────────────────────────────
/** Whether the selected game can be started in the emulator, and why not. */
export interface EmulatorGameCheck {
  launchable: boolean;
  /** Why it cannot be started (translated), null when it can. */
  reason: string | null;
  /** A secondary remark under the reason (translated), e.g. that support for the format is planned; usually null. */
  note: string | null;
  /** The RetroArch core that would run it (null for OpenEmu). */
  core: string | null;
}
export interface EmulatorStatusResponse {
  /** false — the web version: games are not started from here. */
  enabled: boolean;
  /** OpenEmu on macOS, RetroArch on Windows and Linux. */
  emulator: 'OpenEmu' | 'RetroArch';
  /** Where the emulator was found; null when it is not installed. */
  path: string | null;
  /** `settings` — the path chosen by hand, `auto` — found by the application. */
  source: 'settings' | 'auto' | null;
  /** Download page of the emulator. */
  downloadUrl: string;
  /** The path in the settings does not exist any more (the emulator was then looked for automatically). */
  settingsError: string | null;
  /** The check of the game asked for (`?rel=`), null without one. */
  game: EmulatorGameCheck | null;
}
export interface EmulatorLaunchRequest {
  rel: string;
}
export interface EmulatorLaunchResponse {
  emulator: 'OpenEmu' | 'RetroArch';
  core: string | null;
}

// ── Global search ────────────────────────────────────────────────────────────
export type SearchIndexResponse = SearchIndex;

// ── Deletion ────────────────────────────────────────────────────────────
export interface CsvRemoval {
  updated: boolean;
  removed: number;
  reason: string | null;
  backupPath: string | null;
}
export interface DeleteGameRequest {
  rel: string;
  removeFromCsv?: boolean;
  confirmed: true;
}
export interface DeleteGameResponse {
  /** The console's game lists (`*.lst`) that were not changed because they do not read cleanly: shown as errors. */
  listErrors?: string[];
  deleted: string;
  csv: CsvRemoval;
}
export interface DeleteGamesRequest {
  rels: string[];
  removeFromCsv?: boolean;
  confirmed: true;
}
export interface DeleteGamesResponse {
  /** The console's game lists (`*.lst`) that were not changed because they do not read cleanly: shown as errors. */
  listErrors?: string[];
  deleted: string[];
  missing: string[];
  failed: { rel: string; error: string }[];
  csv: CsvRemoval;
}

// ── Images ────────────────────────────────────────────────────────────
export interface SetImageRequest {
  rel: string;
  imagePath: string;
}
export interface SetImageResponse {
  rel: string;
  imagePath: string;
}
export interface DeleteImageRequest {
  rel: string;
  confirmed: true;
}
export interface DeleteImageResponse {
  /** false — a file outside the games/images folders is not deleted, only the binding is removed. */
  deleted: boolean;
  path: string;
}

// ── CSV ───────────────────────────────────────────────────────────────────────────────────────────
export interface CsvPreviewRequest {
  csvPath?: string;
  delimiter?: string;
  encoding?: string;
  hasHeader?: boolean;
}
export interface CsvPreviewResponse {
  path: string;
  exists: boolean;
  headers: string[];
  rows: string[][];
  total: number;
}
export interface CsvDataResponse {
  path: string;
  exists: boolean;
  headers: string[];
  hasHeader: boolean;
  rows: string[][];
}
export interface CsvSaveRequest {
  rows: string[][];
}
export interface CsvSaveResponse {
  rows: number;
  backupPath: string | null;
}
export interface MissingPreviewResponse {
  count: number;
  total: number;
  managed: number;
  /** true — all managed entries point to missing files. */
  all: boolean;
  paths: string[];
}
export interface MissingApplyRequest {
  expected: number;
  confirmed: true;
}
export interface MissingApplyResponse {
  removed: number;
  backupPath: string | null;
}

// ── Synchronization ────────────────────────────────────────────────────────────
export interface SyncPreviewResponse {
  toAdd: number;
  toRemove: number;
  unchanged: number;
  unmanaged: number;
  duplicates: number;
  /** true — the CSV does not exist yet (or is empty): it will be created with every game of the folder. */
  created: boolean;
  /** Rows of the CSV that have no 4th (tags) column yet: it is added to them, empty. */
  tagsColumnAdded: number;
  added: string[];
  removed: string[];
}
/** The folder with the backups (CSV, .lst, filelist.xml) that was opened in the file manager. */
export interface OpenBackupsResponse {
  path: string;
}
export interface SyncApplyRequest {
  confirmed: true;
}
export type SyncApplyResponse = Extract<SyncReport, { ok: true }>;

// ── Adding a game ────────────────────────────────────────────────────────────
export interface InspectRequest {
  kind: FileKind;
  path: string;
}
export interface InspectResponse {
  fileName: string;
  ext: string;
  size: number;
}
export interface InspectSetRequest {
  paths: string[];
}
/** What the selected files will become: one file as it is, or an .img (from .bin + .cue, CloneCD or ECM). */
export interface PlanDescription {
  mode: PlanMode;
  outputName: string;
  /** Size of the resulting game file (for an ECM archive — unpacked). */
  size: number;
  files: { name: string; size: number }[];
  warnings: string[];
}
/** Progress of the game being added right now (`null` when nothing is being added). */
export interface AddProgressResponse {
  progress: { phase: AddPhase; ratio: number } | null;
}
export interface UploadResponse {
  id: string;
  name: string;
  size: number;
}
export interface OkResponse {
  ok: true;
}
export interface AddGameRequest {
  game: SourceRef | SourceRef[];
  title: string;
  image: SourceRef | null;
  /**
   * Pack the game file into `<title>.zip` on the card (the file keeps its name inside the archive). Not allowed for
   * platforms whose emulator does not read archives (PlayStation); ignored when the game file already is a .zip.
   */
  compress?: boolean;
}
export interface AddGameResponse {
  /** The console's game lists (`*.lst`) that were not changed because they do not read cleanly: shown as errors. */
  listErrors?: string[];
  rel: string;
  title: string;
  short: string;
  size: number;
  imageName: string | null;
  /** true — no image was chosen and the cover was generated (platform name and title on a colored box). */
  imageGenerated: boolean;
  mode: PlanMode;
  /** true — the game file was packed into a .zip (`rel` ends with .zip). */
  compressed: boolean;
  warnings: string[];
  /** true — the extension of the game file (.img, .zip) was added to the list of game extensions. */
  extensionsChanged: boolean;
  csv: { mode: 'added' | 'updated'; backupPath: string | null };
}

// ── Editing a game in the table ────────────────────────────────────────────────────────────
/**
 * Changes of the CSV entry of a game; every field is optional, but at least one is required. A changed `name` renames
 * everything that belongs to the game (file, cover, saves) like "Rename game"; the other fields only change the CSV.
 */
export interface UpdateEntryRequest {
  rel: string;
  name?: string;
  short?: string;
  /** The complete list of tags (a tag cannot contain a space). */
  tags?: string[];
  /** Required together with `name`: renaming moves files. */
  confirmed?: boolean;
}
export interface UpdateEntryResponse {
  /** The console's game lists (`*.lst`) that were not changed because they do not read cleanly: shown as errors. */
  listErrors?: string[];
  /** The path of the game now (it changes when the file was renamed). */
  rel: string;
  title: string;
  short: string;
  tags: string[];
  renamed: boolean;
  warnings: string[];
  csvBackupPath: string | null;
}

// ── Renaming a game ────────────────────────────────────────────────────────────
/** `cover` — the generated cover is drawn again with the new title (it keeps the name given by the `image` step). */
export type RenameStepKind = 'game' | 'image' | 'cover' | 'csv' | 'save' | 'state' | 'list' | 'cores';
/** One rename action: file "from" → "to"; for text files — the number of replaced paths. */
export interface RenameStep {
  kind: RenameStepKind;
  from: string;
  to: string | null;
  count?: number;
}
export interface RenamePreviewRequest {
  rel: string;
  title: string;
}
export interface RenamePlanResponse {
  /** The console's game lists (`*.lst`) that were not changed because they do not read cleanly: shown as errors. */
  listErrors?: string[];
  rel: string;
  newRel: string;
  title: string;
  short: string;
  steps: RenameStep[];
  warnings: string[];
}
export interface RenameGameRequest extends RenamePreviewRequest {
  confirmed: true;
}
export interface RenameGameResponse extends RenamePlanResponse {
  csvBackupPath: string | null;
}

// ── New version of the application ────────────────────────────────────────
export interface UpdateRelease {
  /** `1.0.1` (read from the tag: `v1.0.1-rc.1` → `1.0.1`). */
  version: string;
  /** The release page on GitHub. */
  url: string;
  /** The release title ('' when it has none). */
  name: string;
}
export interface UpdateStatusResponse {
  /** The version of this application. */
  current: string;
  /** A release newer than this application, or null (up to date, not checked yet, or the check failed). */
  available: UpdateRelease | null;
  /** Its notice was closed by the user: it is not shown again (until a newer version is out). */
  dismissed: boolean;
  /**
   * What this request did: `checked` — GitHub answered; `skipped` — no check now (switched off, or checked in the last
   * 24 hours: `available` is the result of that check); `failed` — no answer (no connection, limit, error; written to
   * the log only).
   */
  check: 'checked' | 'skipped' | 'failed';
}

// ── Console models ────────────────────────────────────────────────────────
export interface DevicesResponse {
  /** Every model that can be chosen, in display order. */
  devices: DeviceSummary[];
  /** The profile of the model chosen in the settings. */
  active: DeviceProfile;
}
