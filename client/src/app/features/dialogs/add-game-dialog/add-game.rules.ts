import { type DiscSetIssue, detectDiscSet, discSetFile, discSetOutputExt, discSetTitle } from '@shared/discSet';
import { fileExt, toSafeFileName } from '../../../shared/utils/text.utils';

export const IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
export const MAX_GAME_FILES = 64;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** A validation problem: a translation key with its parameters. */
export interface Issue {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * What the selected files become: one file as it is, an .img built from .bin + .cue, CloneCD or an ECM archive,
 * or (`zip`) any of these packed into a .zip archive.
 */
export type TargetKind = 'file' | 'disc' | 'clonecd' | 'ecm' | 'zip';

export interface Target {
  /** The file name in the games folder. */
  name: string;
  kind: TargetKind;
  /** For a .zip: the name of the game file inside the archive. */
  inner?: string;
}

/** The selected game file already is a ZIP archive: there is nothing to compress. */
export const isZipSelection = (names: readonly string[]): boolean => names.some((name) => fileExt(name) === 'zip');

/**
 * Name of the file in the games folder: the game title + the source extension (a disc image set becomes .img).
 * With `compress` the game file is packed into `<title>.zip` and keeps its own name inside the archive.
 */
export function targetFileName(names: readonly string[], title: string, compress = false): Target | null {
  const base = toSafeFileName(title);
  if (!base || !names.length) return null;
  const detected = detectDiscSet(names);
  if (!detected.ok) return null;
  const { set } = detected;
  let target: Target;
  if (set.kind === 'single') {
    const only = names[set.file] ?? '';
    const dot = only.lastIndexOf('.');
    target = { name: base + (dot > 0 ? only.slice(dot) : ''), kind: 'file' };
  } else {
    const ext = discSetOutputExt(set, names.map(discSetFile));
    target = { name: `${base}.${ext}`, kind: set.kind === 'bincue' ? 'disc' : set.kind };
  }
  if (!compress || fileExt(target.name) === 'zip') return target;
  return { name: `${base}.zip`, kind: 'zip', inner: target.name };
}

/** The file the game title is taken from: the .ccd or .cue of a set, otherwise the first file (without .ecm and extension). */
export function titleFromFiles(names: readonly string[]): string | null {
  const main = names.find((name) => fileExt(name) === 'ccd') ?? names.find((name) => fileExt(name) === 'cue') ?? names[0];
  return main === undefined ? null : discSetTitle(main);
}

function setIssue(issue: DiscSetIssue): Issue {
  switch (issue.code) {
    case 'empty': return { key: 'addGame.errors.unknownType' };
    case 'mixed': return { key: 'addGame.errors.onlyDiscFormats' };
    case 'multipleCue': return { key: 'addGame.errors.multipleCue' };
    case 'multipleCcd': return { key: 'addGame.errors.multipleCcd' };
    case 'cueRequired': return { key: 'addGame.errors.cueRequired' };
    case 'missing': return { key: 'addGame.errors.missingFiles', params: { files: issue.files.join(', ') } };
    case 'duplicate': return { key: 'addGame.errors.duplicateFiles', params: { files: issue.files.join(', ') } };
    case 'extra': return { key: 'addGame.errors.extraFiles', params: { files: issue.files.join(', ') } };
  }
}

/** Quick check of the game file set (before the server is asked). Returns the problem or null. */
export function validateGameSet(names: readonly string[], extensions: readonly string[]): Issue | null {
  if (names.length > MAX_GAME_FILES) return { key: 'addGame.errors.tooManyFiles', params: { max: MAX_GAME_FILES } };
  const exts = names.map(fileExt);
  if (exts.some((ext) => !ext)) return { key: 'addGame.errors.unknownType' };
  if (exts.some((ext) => IMAGE_EXTENSIONS.includes(ext))) return { key: 'addGame.errors.isImage' };
  const detected = detectDiscSet(names);
  if (!detected.ok) return setIssue(detected.issue);
  const { set } = detected;
  const notAllowed = (ext: string): Issue | null => extensions.length && !extensions.includes(ext)
    ? { key: 'addGame.errors.extensionNotAllowed', params: { ext, extensions: extensions.join(', ') } }
    : null;
  if (set.kind === 'single') {
    const only = exts[set.file] ?? '';
    if (only === 'bin' && extensions.length && !extensions.includes('bin')) return { key: 'addGame.errors.binNeedsCue' };
    return notAllowed(only);
  }
  if (set.kind === 'ecm' && set.outputExt !== 'img') return notAllowed(set.outputExt);
  if (set.kind === 'bincue' && !set.bins.length) return { key: 'addGame.errors.binRequired' };
  return null;
}
