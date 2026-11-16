/**
 * Console models ("devices"): everything that depends on the model of the console — the platform folders of its card
 * and their names, the system folders, the game list (CSV) format, where saves and lists live, the cover size, the
 * game formats and the start-screen tips. The profiles are JSON files in `devices/`; the
 * server loads and checks them, the client receives the active one. This file holds the types and the pure lookups
 * both sides use. It imports no other modules: both Node and the Angular build execute it.
 */

/**
 * Colors of a generated cover (CSS hex colors). Own design: a gradient box, a header band with the platform name and
 * an accent stripe. No logos or trademarks of the platform owners are used.
 */
export interface CoverPalette {
  /** Gradient of the box, top-left → bottom-right. */
  from: string;
  to: string;
  /** Stripe under the header band and decorations. */
  accent: string;
  /** Text color (light on the backgrounds). */
  text: string;
}

export interface PlatformInfo {
  /** The folder name on the card (matched without regard to case). */
  folder: string;
  /** The full name shown next to the folder. Proper names, not translated. */
  name: string;
  /** Whether a game of this platform may be compressed to .zip when it is added (the console reads it from the archive). */
  zip: boolean;
  /** The system of the platform for the computer's emulators (FC, SFC, GBA, PS, …: see services/emulator/catalog.ts). */
  system: string;
  cover: CoverPalette;
}

/**
 * A field of a line of the console's game lists (`*.lst`): the path of the game file (`PS/Hercules.img`), its title,
 * the title in upper case, the short name (camelCase) and the short name in upper case.
 */
export type ListField = 'path' | 'title' | 'titleUpper' | 'short' | 'shortUpper';
export const LIST_FIELDS: readonly ListField[] = ['path', 'title', 'titleUpper', 'short', 'shortUpper'];

export interface DeviceCsvFormat {
  /** The game list of a platform folder. */
  fileName: string;
  delimiter: ',' | ';' | '\t';
  encoding: string;
  /** The first line holds column names. */
  header: boolean;
  /** A new file starts with a UTF-8 byte order mark. */
  bom: boolean;
  lineEnding: 'crlf' | 'lf';
}

export interface DeviceTips {
  /** The processor of the console (named in the firmware warning); '' — no firmware tip. */
  cpu: string;
  /** Custom firmware that does not fit the console (named in the warning). */
  incompatibleFirmware: string;
  /** Page about the console and the recovery of its stock firmware (`{{firmwareLink}}` in the tip; '' hides the text). */
  firmwareLink: string;
  /** A community resource about the console (`{{communityLink}}` in the tip; '' hides the line). */
  communityLink: string;
}

export interface DeviceProfile {
  /** The file name without `.json`; stored in the settings. */
  id: string;
  /** The model name shown to the user. */
  name: string;
  /** Position in the list of models. */
  order: number;
  /** How a card of this model is recognized: folders or files in the card root (names compared without case). */
  detect: { anyOf: string[]; allOf: string[] };
  folders: {
    /** System folders: the application never writes into them (except the saves folder, see below). */
    system: string[];
    /** The system folder with saves and lists ('' — none): written only when a game is renamed. */
    saves: string;
    /** Folders of the card root that are not platforms (books, photos, music, movies). */
    media: string[];
  };
  /** Inside the saves folder: what renaming a game renames too. */
  saves: {
    /** Folder of the saves ('' — none). */
    saves: string;
    /** Folder of the quick saves (states) ('' — none). */
    states: string;
    /** Lists that name games by path (`allfiles.lst`, `favorites.lst`, `recent.lst`). */
    lists: string[];
    /**
     * The list of every game (`allfiles.lst`, one of `lists`): an added game, or one found by the sync, gets a line
     * there. The other lists only follow renames and lose the lines of removed games. '' — none.
     */
    mainList: string;
    /** A line of the lists: the fields in this order, joined by the separator. The first field must be `path`. */
    listFormat: { separator: string; fields: ListField[] };
    /** The core bindings file (`cores/filelist.xml`; '' — none). */
    cores: string;
  };
  csv: DeviceCsvFormat;
  /** Covers: the folder next to the games and the size of a generated cover. */
  covers: { folder: string; width: number; height: number };
  /** Game file extensions offered by default. */
  extensions: string[];
  /** Known platforms in display order. */
  platforms: PlatformInfo[];
  tips: DeviceTips;
}

/** A model in the list of the settings. */
export interface DeviceSummary {
  id: string;
  name: string;
}

/** Colors of the cover of a game whose folder is not a known platform (or when no platform is chosen). */
export const DEFAULT_COVER: CoverPalette = { from: '#3a4556', to: '#111827', accent: '#9ca3af', text: '#ffffff' };

const key = (folder: string): string => folder.trim().toLowerCase();

/** The platform of a folder on the card, or null when the folder is not a known platform of the model (`roms`). */
export const platformInfo = (device: DeviceProfile | null | undefined, folder: string): PlatformInfo | null =>
  device?.platforms.find((platform) => key(platform.folder) === key(folder)) ?? null;

/** Position of the platform in the model's list (for sorting), or -1 for an unknown folder. */
export const platformOrder = (device: DeviceProfile | null | undefined, folder: string): number =>
  device?.platforms.findIndex((platform) => key(platform.folder) === key(folder)) ?? -1;

/** The full platform name for a folder, or null when the folder is not a known platform. */
export const platformName = (device: DeviceProfile | null | undefined, folder: string): string | null =>
  platformInfo(device, folder)?.name ?? null;

/**
 * Whether a game added to this platform may be compressed to .zip. An unknown folder or no platform at all (a games
 * folder chosen by hand) allows it; only platforms marked in the profile (PlayStation) do not.
 */
export const canCompressToZip = (device: DeviceProfile | null | undefined, folder: string): boolean =>
  platformInfo(device, folder)?.zip ?? true;

/** Colors of the generated cover for a platform folder (the neutral palette for an unknown folder). */
export const coverPalette = (device: DeviceProfile | null | undefined, folder: string): CoverPalette =>
  platformInfo(device, folder)?.cover ?? DEFAULT_COVER;
