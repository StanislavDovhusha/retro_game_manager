import fsp from 'node:fs/promises';
import { t } from '../../i18n/index.ts';
import { ValidationError } from '../../utils/errors.ts';

/** Sector size by the track mode in a .cue file. */
const SECTOR_SIZE: Record<string, number> = {
  AUDIO: 2352,
  'MODE1/2352': 2352,
  'MODE2/2352': 2352,
  'MODE1/2048': 2048,
  'MODE2/2336': 2336,
};

interface CueFile {
  name: string;
  /** Sector size in bytes; null until the first TRACK of the file is seen. */
  sector: number | null;
}

export interface CueInfo {
  files: (CueFile & { sector: number })[];
  tracks: number;
  hasAudio: boolean;
}

/**
 * Parses a .cue: the list of files (in order), the sector size of each, the number of tracks.
 * Only BINARY images are supported; audio files (WAVE, MP3) and the like are rejected.
 */
export function parseCue(text: string): CueInfo {
  const files: CueFile[] = [];
  let tracks = 0;
  let hasAudio = false;
  let current: CueFile | null = null;

  for (const raw of String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)) {
    const line = raw.trim();
    let match = /^FILE\s+(?:"([^"]*)"|(\S+))\s+(\S+)/i.exec(line);
    if (match) {
      const type = (match[3] ?? '').toUpperCase();
      if (type !== 'BINARY') {
        throw new ValidationError(t('The .cue refers to a file of type {type}: only .bin images (BINARY) are supported', { type }));
      }
      current = { name: (match[1] ?? match[2] ?? '').split(/[\\/]/).pop() ?? '', sector: null };
      files.push(current);
      continue;
    }
    match = /^TRACK\s+\d+\s+(\S+)/i.exec(line);
    if (match) {
      if (!current) throw new ValidationError(t('The .cue has a TRACK line before FILE — the file is corrupted'));
      const mode = (match[1] ?? '').toUpperCase();
      const sector = SECTOR_SIZE[mode];
      if (!sector) throw new ValidationError(t('The .cue uses an unsupported track mode: {mode}', { mode }));
      if (current.sector === null) current.sector = sector;
      else if (current.sector !== sector) {
        throw new ValidationError(
          t('The tracks in “{name}” have different sector sizes — such an image is not supported', { name: current.name }),
        );
      }
      if (mode === 'AUDIO') hasAudio = true;
      tracks += 1;
    }
  }
  if (!files.length) throw new ValidationError(t('The .cue has no FILE lines — this is not a cue file'));
  const done: CueInfo['files'] = [];
  for (const file of files) {
    if (file.sector === null) throw new ValidationError(t('No TRACK is specified in the .cue for the file “{name}”', { name: file.name }));
    done.push({ name: file.name, sector: file.sector });
  }
  return { files: done, tracks, hasAudio };
}

/** Reads a .cue as text: UTF-8, or a single-byte encoding when it is not valid UTF-8 (old .cue files). */
export async function readCueText(abs: string): Promise<string> {
  const buf = await fsp.readFile(abs);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

/**
 * Matches the files named in the .cue with the selected .bin files and returns the .bin files in the .cue order.
 * With exactly one file on both sides the names may differ (the file could have been renamed).
 */
export function pairBins<B extends { fileName: string }>(refs: { name: string }[], bins: B[]): B[] {
  const [onlyBin] = bins;
  if (refs.length === 1 && bins.length === 1 && onlyBin) return [onlyBin];

  const byName = new Map(bins.map((bin) => [bin.fileName.toLowerCase(), bin]));
  if (byName.size !== bins.length) throw new ValidationError(t('Selected .bin files have identical names'));

  const used = new Set<string>();
  const ordered = refs.map((ref) => {
    const key = ref.name.toLowerCase();
    if (used.has(key)) throw new ValidationError(t('The file “{name}” is listed several times in the .cue', { name: ref.name }));
    const bin = byName.get(key);
    if (!bin) {
      throw new ValidationError(
        t('The .cue refers to the file “{name}”, but it is not selected. Select it together with the .cue.', { name: ref.name }),
      );
    }
    used.add(key);
    return bin;
  });
  const extra = bins.find((bin) => !used.has(bin.fileName.toLowerCase()));
  if (extra) {
    throw new ValidationError(
      t('The file “{fileName}” is not listed in the .cue — remove it from the selection.', { fileName: extra.fileName }),
    );
  }
  return ordered;
}
