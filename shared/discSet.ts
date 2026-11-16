/**
 * Recognizes what a set of selected game files is: one game file, a BIN/CUE disc image, a CloneCD image
 * (.ccd + .img + .sub) or an ECM archive (`Game.img.ecm`, `Game.bin.ecm`), possibly together with its .ccd/.sub/.cue.
 * Pure logic on file names, shared by the client (a quick check right after a drop) and the server (the real check).
 * The file imports no other modules: both Node (running .ts directly) and the Angular build execute it.
 */

/** Extensions of the parts of disc image sets: they can be selected together. */
export const DISC_SET_EXTENSIONS: readonly string[] = ['bin', 'cue', 'img', 'ccd', 'sub', 'ecm'];

/** A selected file as the set detection sees it. */
export interface DiscSetFile {
  /** The selected file name. */
  name: string;
  /** Its extension (lower case, without the dot). */
  ext: string;
  /** true — an ECM archive that is unpacked while the game is added. */
  ecm: boolean;
  /** The name of the data the file holds: the file name, or for an ECM archive the name without `.ecm`. */
  unpacked: string;
  /** The extension of `unpacked` (lower case); `''` for a bare `Game.ecm`. */
  unpackedExt: string;
  /** `unpacked` without its extension, lower case: files of one set share it. */
  key: string;
}

export type DiscSet =
  /** One game file, copied as it is. */
  | { kind: 'single'; file: number }
  /** One ECM archive: unpacked into the game file (`outputExt` — `img` for a raw disc image). */
  | { kind: 'ecm'; file: number; outputExt: string }
  /** A .cue and the .bin files it lists (some of them may be ECM archives); `bins` may be empty. */
  | { kind: 'bincue'; cue: number; bins: number[] }
  /** CloneCD: the .ccd, the .img (maybe an ECM archive) and an optional .sub. */
  | { kind: 'clonecd'; ccd: number; img: number; sub: number | null; ignored: number[] };

export type DiscSetIssue =
  | { code: 'empty' }
  /** Files that cannot be selected together (e.g. a .txt with a .bin). */
  | { code: 'mixed' }
  | { code: 'multipleCue' }
  | { code: 'multipleCcd' }
  /** Several .bin files without a .cue. */
  | { code: 'cueRequired' }
  /** The set is incomplete: the names of the missing files. */
  | { code: 'missing'; files: string[] }
  /** Two selected files hold the same data (e.g. `Game.img` and `Game.img.ecm`). */
  | { code: 'duplicate'; files: string[] }
  /** Files that do not belong to the recognized set. */
  | { code: 'extra'; files: string[] };

export type DiscSetResult = { ok: true; set: DiscSet } | { ok: false; issue: DiscSetIssue };

const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};
const stripExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

/** Describes one selected file (an ECM archive by the name of the file inside it). */
export function discSetFile(name: string): DiscSetFile {
  const ext = extOf(name);
  const ecm = ext === 'ecm';
  const unpacked = ecm ? stripExt(name) : name;
  const unpackedExt = extOf(unpacked);
  return { name, ext, ecm, unpacked, unpackedExt, key: (unpackedExt ? stripExt(unpacked) : unpacked).toLowerCase() };
}

/** The base of the game title for a set: the file name without `.ecm` and the extension (`Game.img.ecm` → `Game`). */
export function discSetTitle(name: string): string {
  const file = discSetFile(name);
  return file.unpackedExt ? stripExt(file.unpacked) : file.unpacked;
}

/** What a raw disc image becomes: a bare `.ecm`, `.bin` and `.img` all are saved as `.img`. */
const RAW_IMAGE = ['', 'bin', 'img'];

/** The name of the file the set is built into: `img` for every disc image, otherwise the extension of the single file. */
export function discSetOutputExt(set: DiscSet, files: readonly DiscSetFile[]): string | null {
  if (set.kind === 'ecm') return set.outputExt;
  if (set.kind === 'single') return files[set.file]?.ext ?? null;
  return 'img';
}

const by = (files: readonly DiscSetFile[], test: (file: DiscSetFile) => boolean): number[] =>
  files.flatMap((file, index) => (test(file) ? [index] : []));

/** Two selected files that would give the same data (case does not matter). */
function duplicates(files: readonly DiscSetFile[]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const file of files) {
    const key = file.unpacked.toLowerCase();
    const other = seen.get(key);
    if (other !== undefined) out.push(other, file.name);
    else seen.set(key, file.name);
  }
  return [...new Set(out)];
}

/** Picks the file of the set by name (`key`); when there is only one candidate its name may differ (a renamed file). */
function pick(files: readonly DiscSetFile[], candidates: number[], key: string): number | null {
  const same = candidates.filter((index) => files[index]?.key === key);
  if (same.length === 1) return same[0] ?? null;
  if (same.length === 0 && candidates.length === 1) return candidates[0] ?? null;
  return null;
}

function cloneCd(files: readonly DiscSetFile[], ccd: number): DiscSetResult {
  const control = files[ccd];
  if (!control) return { ok: false, issue: { code: 'empty' } };
  const base = stripExt(control.name);
  const imgs = by(files, (file) => file.unpackedExt === 'img' || (file.ecm && file.unpackedExt === ''));
  const subs = by(files, (file) => file.ext === 'sub');
  const img = pick(files, imgs, control.key);
  if (img === null) {
    return imgs.length
      ? { ok: false, issue: { code: 'extra', files: imgs.map((index) => files[index]?.name ?? '') } }
      : { ok: false, issue: { code: 'missing', files: [`${base}.img`] } };
  }
  const sub = subs.length ? pick(files, subs, control.key) : null;
  if (subs.length && sub === null) return { ok: false, issue: { code: 'extra', files: subs.map((index) => files[index]?.name ?? '') } };
  // A .cue of the same dump is not needed: the .ccd describes the disc.
  const ignored = by(files, (file) => file.ext === 'cue' && file.key === control.key);
  const used = new Set([ccd, img, ...(sub === null ? [] : [sub]), ...ignored]);
  const extra = files.filter((_, index) => !used.has(index)).map((file) => file.name);
  if (extra.length) return { ok: false, issue: { code: 'extra', files: extra } };
  return { ok: true, set: { kind: 'clonecd', ccd, img, sub, ignored } };
}

/**
 * Recognizes the set of selected files. One file is copied as it is, unless it is a part of a disc image that needs
 * the others (.ccd, .sub, .cue). Several files must be the parts of one disc image.
 */
export function detectDiscSet(names: readonly string[]): DiscSetResult {
  const files = names.map(discSetFile);
  const [only] = files;
  if (!only) return { ok: false, issue: { code: 'empty' } };

  const dup = duplicates(files);
  if (dup.length) return { ok: false, issue: { code: 'duplicate', files: dup } };

  const ccds = by(files, (file) => file.ext === 'ccd');
  const cues = by(files, (file) => file.ext === 'cue');
  const subs = by(files, (file) => file.ext === 'sub');

  if (files.length === 1) {
    const base = discSetTitle(only.name);
    if (only.ext === 'ccd') return { ok: false, issue: { code: 'missing', files: [`${base}.img`] } };
    if (only.ext === 'sub') return { ok: false, issue: { code: 'missing', files: [`${base}.ccd`, `${base}.img`] } };
    if (only.ext === 'cue') return { ok: true, set: { kind: 'bincue', cue: 0, bins: [] } };
    if (only.ecm)
      return { ok: true, set: { kind: 'ecm', file: 0, outputExt: RAW_IMAGE.includes(only.unpackedExt) ? 'img' : only.unpackedExt } };
    return { ok: true, set: { kind: 'single', file: 0 } };
  }

  if (files.some((file) => !DISC_SET_EXTENSIONS.includes(file.ext) || (file.ecm && !RAW_IMAGE.includes(file.unpackedExt)))) {
    return { ok: false, issue: { code: 'mixed' } };
  }
  if (ccds.length > 1) return { ok: false, issue: { code: 'multipleCcd' } };
  const [ccd] = ccds;
  if (ccd !== undefined) return cloneCd(files, ccd);

  if (cues.length > 1) return { ok: false, issue: { code: 'multipleCue' } };
  const [cue] = cues;
  if (cue !== undefined) {
    if (subs.length) return { ok: false, issue: { code: 'extra', files: subs.map((index) => files[index]?.name ?? '') } };
    return { ok: true, set: { kind: 'bincue', cue, bins: by(files, (file) => file.ext !== 'cue') } };
  }

  // Neither .ccd nor .cue: a .sub tells it is a CloneCD set without its .ccd.
  const [sub] = subs;
  if (sub !== undefined) {
    const base = discSetTitle(files[sub]?.name ?? '');
    const missing = [`${base}.ccd`];
    if (!files.some((file) => file.unpackedExt === 'img' || (file.ecm && file.unpackedExt === ''))) missing.push(`${base}.img`);
    return { ok: false, issue: { code: 'missing', files: missing } };
  }
  return { ok: false, issue: { code: 'cueRequired' } };
}
