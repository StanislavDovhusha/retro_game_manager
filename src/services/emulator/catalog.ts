/**
 * What the emulators can run: the platforms of the card (folder codes of shared/platforms.ts) and the file formats.
 * Edit the lists here when an emulator learns a new format; nothing else needs to change.
 *
 * OpenEmu (macOS) has one built-in core per system and reads zipped cartridge games itself; it has no arcade (MAME)
 * support in its stable releases and reads PlayStation discs only through a .cue/.ccd/.m3u/.pbp/.chd file.
 * RetroArch (Windows, Linux) runs a "core" per system; the cores are listed in the order they are preferred, and the
 * first one that is installed and reads the format is used. RetroArch unpacks .zip/.7z itself for any core.
 */

export const EMULATORS = {
  openemu: { name: 'OpenEmu', downloadUrl: 'https://openemu.org', bundleId: 'org.openemu.OpenEmu' },
  retroarch: { name: 'RetroArch', downloadUrl: 'https://www.retroarch.com' },
} as const;

export type EmulatorKind = keyof typeof EMULATORS;

const ARCHIVES = ['zip', '7z'] as const;

/** OpenEmu: platform → file extensions it opens. A platform that is not listed is not supported. */
export const OPENEMU_FORMATS: Readonly<Record<string, readonly string[]>> = {
  FC: ['nes', 'fds', 'unf', 'unif', 'zip'],
  SFC: ['sfc', 'smc', 'fig', 'swc', 'bs', 'zip'],
  GBA: ['gba', 'zip'],
  GB: ['gb', 'gbc', 'zip'],
  GBC: ['gbc', 'gb', 'zip'],
  MD: ['md', 'gen', 'smd', 'bin', 'zip'],
  PS: ['cue', 'ccd', 'm3u', 'pbp', 'chd'],
  PCE: ['pce', 'sgx', 'cue', 'zip'],
  SMS: ['sms', 'zip'],
  GG: ['gg', 'zip'],
  NGPC: ['ngc', 'ngp', 'zip'],
  WSC: ['wsc', 'ws', 'zip'],
  ATARI: ['a26', 'a52', 'a78', 'lnx', 'bin', 'zip'],
};

/**
 * Formats the emulator cannot open yet but the application is going to make it open (OpenEmu reads PlayStation discs
 * only through a .cue; the .img made by "Add game" will get one). The reason under the button then gets a note that
 * the support is coming. Remove the entry when that support is released.
 */
export const PLANNED_FORMATS: Readonly<Record<EmulatorKind, Readonly<Record<string, readonly string[]>>>> = {
  openemu: { PS: ['img'] },
  retroarch: {},
};

export interface RetroArchCore {
  /** The core's file name without `_libretro.<dll|so|dylib>`. */
  core: string;
  extensions: readonly string[];
}

const cores = (names: readonly string[], extensions: readonly string[]): RetroArchCore[] =>
  names.map((core) => ({ core, extensions: [...extensions, ...ARCHIVES] }));

/** RetroArch: platform → cores in the order they are preferred, each with the extensions it opens. */
export const RETROARCH_CORES: Readonly<Record<string, readonly RetroArchCore[]>> = {
  FC: cores(['fceumm', 'nestopia', 'mesen', 'quicknes'], ['nes', 'fds', 'unf', 'unif']),
  SFC: cores(['snes9x', 'bsnes', 'snes9x2010', 'mesen-s'], ['sfc', 'smc', 'fig', 'swc', 'bs']),
  GBA: cores(['mgba', 'vbam', 'vba_next', 'gpsp'], ['gba']),
  GB: cores(['gambatte', 'sameboy', 'mgba', 'gearboy'], ['gb', 'gbc', 'dmg']),
  GBC: cores(['gambatte', 'sameboy', 'mgba', 'gearboy'], ['gbc', 'gb']),
  MD: cores(['genesis_plus_gx', 'picodrive', 'blastem'], ['md', 'gen', 'smd', 'bin']),
  PS: [
    ...cores(['swanstation', 'pcsx_rearmed'], ['cue', 'bin', 'img', 'chd', 'pbp', 'm3u']),
    ...cores(['mednafen_psx_hw', 'mednafen_psx'], ['cue', 'ccd', 'chd', 'pbp', 'm3u']),
  ],
  PCE: cores(['mednafen_pce_fast', 'mednafen_pce', 'mednafen_supergrafx'], ['pce', 'sgx', 'cue', 'ccd', 'chd']),
  SMS: cores(['genesis_plus_gx', 'picodrive', 'gearsystem', 'smsplus'], ['sms']),
  GG: cores(['genesis_plus_gx', 'gearsystem', 'picodrive'], ['gg']),
  NGPC: cores(['mednafen_ngp', 'race'], ['ngp', 'ngc']),
  WSC: cores(['mednafen_wswan'], ['ws', 'wsc']),
  // The ATARI folder may hold games of several Atari systems: each core reads its own format.
  ATARI: [
    ...cores(['stella', 'stella2014'], ['a26', 'bin']),
    ...cores(['atari800'], ['a52', 'xex', 'atr']),
    ...cores(['prosystem'], ['a78']),
    ...cores(['handy', 'mednafen_lynx'], ['lnx']),
  ],
  MAME: cores(['mame2003_plus', 'mame2003', 'fbneo', 'mame2010', 'mame'], []),
};

/** Extensions an emulator opens for a platform (empty: the platform is not supported). */
export function supportedFormats(kind: EmulatorKind, platform: string): string[] {
  if (kind === 'openemu') return [...(OPENEMU_FORMATS[platform] ?? [])];
  return [...new Set((RETROARCH_CORES[platform] ?? []).flatMap((core) => core.extensions))];
}

/** The format is not supported yet, but support for it is planned (see PLANNED_FORMATS). */
export const isPlannedFormat = (kind: EmulatorKind, platform: string, ext: string): boolean =>
  PLANNED_FORMATS[kind][platform]?.includes(ext) ?? false;

/** RetroArch cores that open this extension for the platform, most preferred first. */
export const coresFor = (platform: string, ext: string): string[] => [
  ...new Set((RETROARCH_CORES[platform] ?? []).filter((core) => core.extensions.includes(ext)).map((core) => core.core)),
];
