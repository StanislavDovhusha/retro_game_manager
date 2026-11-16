import iconv from 'iconv-lite';
import type { ListField } from '../../../shared/devices.ts';
import { toCamelCase } from '../../utils/text.ts';

/**
 * The game lists of the console (`allfiles.lst`, `favorites.lst`, `recent.lst` on the current models): one line per
 * game, the fields joined by a separator —
 *
 *   PS/Parasite Eve II.img|Parasite Eve II|PARASITE EVE II|parasiteEveIi|PARASITEEVEII
 *
 * Pure (no files): building a line, reading and writing a list's text, and the edits. `consoleLists.ts` does the disk
 * work. A line is found by its first field, the path, compared exactly; a line that cannot be read (another number of
 * fields) is never changed.
 */

export interface ListFormat {
  separator: string;
  fields: readonly ListField[];
}

/** A game as the lists name it. */
export interface ListGame {
  /** The platform folder on the card (`PS`). */
  platform: string;
  /** The game file relative to the platform folder (`Hercules.img`, `sub/Game.zip`). */
  rel: string;
  /** The title (the CSV title, or the file name without the extension). */
  title: string;
  /** The short name typed by the user ('' — none: it is made from the title). */
  short: string;
}

/** `PS/Hercules.img`: the platform folder and the file, always with `/` (on Windows too). */
export const listPath = (platform: string, rel: string): string => `${platform}/${rel}`.replace(/\\/g, '/');

/** A short name already in camelCase: one word that starts with a lower-case letter or a digit (`daiMakaiMura`). */
const CAMEL_CASE = /^[\p{Ll}\p{N}][\p{L}\p{N}]*$/u;

/**
 * The short name of a line: the user's short name, or the title when there is none, in camelCase. Words are split at
 * spaces, hyphens and other punctuation (which is dropped, as for the CSV short names: "Tom & Jerry" → tomJerry); the
 * first word is lower case, the others start with a capital letter (`Parasite Eve II` → `parasiteEveIi`). A short
 * name that already is camelCase is kept as typed (`daiMakaiMura`).
 */
export function listShortName(short: string, title: string): string {
  const source = short.trim() || title.trim();
  return CAMEL_CASE.test(source) ? source : toCamelCase(source);
}

/**
 * Every field of the line of a game. The only place where the fields are made: adding, renaming, editing the short
 * name and the sync all use it.
 */
export function listFields(game: ListGame): Record<ListField, string> {
  const short = listShortName(game.short, game.title);
  return {
    path: listPath(game.platform, game.rel),
    title: game.title,
    titleUpper: game.title.toUpperCase(),
    short,
    shortUpper: short.toUpperCase(),
  };
}

/** The line of a game, or null when a value contains the separator or a line break (it cannot be written). */
export function formatListLine(format: ListFormat, game: ListGame): string | null {
  const fields = listFields(game);
  const values = format.fields.map((field) => fields[field]);
  if (values.some((value) => value.includes(format.separator) || /[\r\n]/.test(value))) return null;
  return values.join(format.separator);
}

/** The path (first field) of a line, or null for a line that cannot be read (another number of fields, empty). */
export function linePath(line: string, format: ListFormat): string | null {
  const parts = line.split(format.separator);
  return parts.length === format.fields.length && parts[0] ? parts[0] : null;
}

// ── The text of a list ──────────────────────────────────────────────────────────────────────

export interface ListDocument {
  lines: string[];
  eol: '\n' | '\r\n';
  /** The text ends with a line break. */
  finalEol: boolean;
  /** `utf8`, `utf-16le` or `utf-16be` (see `listEncoding`). */
  encoding: string;
  /** The file starts with a byte order mark (kept as it was: a list without one never gets one). */
  bom: boolean;
}

/** A new list: UTF-8 without a byte order mark (the console reads a BOM as part of the first line), LF. */
export const newListDocument = (): ListDocument => ({ lines: [], eol: '\n', finalEol: true, encoding: 'utf8', bom: false });

/** The encoding of a list and whether the file starts with a byte order mark. */
export interface ListEncoding {
  encoding: string;
  bom: boolean;
}

/**
 * The encoding of a list: a byte order mark decides (UTF-8, UTF-16 LE/BE); without one the file is UTF-8, the
 * encoding of the console.
 */
export function listEncoding(buf: Uint8Array): ListEncoding {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { encoding: 'utf8', bom: true };
  if (buf[0] === 0xff && buf[1] === 0xfe) return { encoding: 'utf-16le', bom: true };
  if (buf[0] === 0xfe && buf[1] === 0xff) return { encoding: 'utf-16be', bom: true };
  return { encoding: 'utf8', bom: false };
}

/** Why a list cannot be changed safely. */
export interface ListReadProblem {
  kind: 'undecodable';
  /** The encoding the file was read in (the one that was assumed). */
  encoding: string;
}

/**
 * Reads the bytes of a list in its encoding (see `listEncoding`); the line ends are kept (CRLF when the file has any,
 * otherwise LF). A file that does not read cleanly in that encoding (the text gets replacement characters �) is
 * reported, never changed: writing it back would damage it.
 */
export function decodeList(buf: Uint8Array): { doc: ListDocument } | { problem: ListReadProblem } {
  const { encoding, bom } = listEncoding(buf);
  const body = bom ? buf.subarray(encoding === 'utf8' ? 3 : 2) : buf;
  const text = new TextDecoder(encoding, { ignoreBOM: true }).decode(body);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const finalEol = /\r?\n$/.test(text);
  const lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
  if (lines.some(isUndecodableLine)) return { problem: { kind: 'undecodable', encoding } };
  return { doc: { lines, eol, finalEol, encoding, bom } };
}

/** Columns of a full list line (`path|title|TITLE|short|SHORT`). */
const FULL_LINE_COLUMNS = 5;
/** Columns that must decode cleanly: the path and the title, which are Latin. */
const CHECKED_COLUMNS = 2;

/**
 * True when a line holds U+FFFD where it matters. The console's own lists on some firmware carry broken bytes in the
 * localized short names (columns 4 and 5) of a valid UTF-8 file, so a full line is checked only in its path and title;
 * any other line is checked whole.
 */
function isUndecodableLine(line: string): boolean {
  if (!line.includes('\uFFFD')) return false;
  const cols = line.split('|');
  if (cols.length < FULL_LINE_COLUMNS) return true;
  return cols.slice(0, CHECKED_COLUMNS).some((col) => col.includes('\uFFFD'));
}

/** The text of a list (its own line ends). */
const listText = (doc: ListDocument): string => doc.lines.join(doc.eol) + (doc.finalEol && doc.lines.length ? doc.eol : '');

/**
 * The bytes of a list in its own encoding, with the byte order mark only when the file had one. Null when the text
 * cannot be written in that encoding (a new title with letters a one-byte encoding does not have): nothing is lost then.
 */
export function encodeList(doc: ListDocument): Buffer | null {
  const text = listText(doc);
  if (doc.encoding === 'utf8')
    return Buffer.concat([doc.bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(text, 'utf8')]);
  const body = iconv.encode(text, doc.encoding);
  if (iconv.decode(body, doc.encoding) !== text) return null;
  const mark = doc.bom ? iconv.encode('\ufeff', doc.encoding) : Buffer.alloc(0);
  return Buffer.concat([mark, body]);
}

// ── Edits ───────────────────────────────────────────────────────────────────────────────────

export type ListChange =
  /**
   * A game was added, renamed, or its title or short name changed: its line (found by `oldPath`, or by its own path)
   * gets the new fields in place. `add` — appended when the list has no line of it (the main list on adding).
   */
  | { kind: 'put'; game: ListGame; oldPath?: string; add: boolean }
  /** Games were deleted: their lines go. */
  | { kind: 'remove'; paths: readonly string[] }
  /**
   * The sync of a platform folder: lines of that platform whose file is gone are removed; with `add`, games without a
   * line get one. A game whose only change is the extension (`Game.gba` → `Game.zip`, same folder and name) keeps its
   * line, with the new path.
   */
  | { kind: 'sync'; platform: string; games: readonly ListGame[]; add: boolean };

export interface ListEditResult {
  lines: string[];
  added: number;
  updated: number;
  removed: number;
  /** Paths of games whose line could not be written (a title or short name with the separator). */
  skipped: string[];
}

const withoutExt = (p: string): string => p.replace(/\.[^./]*$/, '');

/** Applies a change to the lines of a list (pure; lines that cannot be read are kept as they are). */
export function editList(lines: readonly string[], format: ListFormat, change: ListChange): ListEditResult {
  const out = [...lines];
  const result: ListEditResult = { lines: out, added: 0, updated: 0, removed: 0, skipped: [] };
  const indexOf = (target: string): number => out.findIndex((line) => linePath(line, format) === target);

  const put = (game: ListGame, findPath: string, add: boolean): void => {
    const line = formatListLine(format, game);
    const index = indexOf(findPath);
    if (index < 0 && !add) return;
    if (line === null) {
      result.skipped.push(listPath(game.platform, game.rel));
      return;
    }
    if (index >= 0) {
      if (out[index] !== line) {
        out[index] = line;
        result.updated += 1;
      }
    } else {
      out.push(line);
      result.added += 1;
    }
  };

  if (change.kind === 'put') {
    put(change.game, change.oldPath ?? listPath(change.game.platform, change.game.rel), change.add);
  } else if (change.kind === 'remove') {
    const gone = new Set(change.paths);
    for (let i = out.length - 1; i >= 0; i -= 1) {
      const path = linePath(out[i] ?? '', format);
      if (path !== null && gone.has(path)) {
        out.splice(i, 1);
        result.removed += 1;
      }
    }
  } else {
    const prefix = `${change.platform}/`;
    const present = new Map(change.games.map((game) => [listPath(game.platform, game.rel), game]));
    const listed = new Set(out.map((line) => linePath(line, format)).filter((path): path is string => path !== null));
    const missing = [...listed].filter((path) => path.startsWith(prefix) && !present.has(path));
    const fresh = [...present.keys()].filter((path) => !listed.has(path));
    // A game whose extension changed (the file was compressed to .zip): one gone and one new path with the same name.
    const moved = new Map<string, string>();
    for (const old of missing) {
      const candidates = fresh.filter((path) => withoutExt(path) === withoutExt(old));
      const others = missing.filter((path) => withoutExt(path) === withoutExt(old));
      if (candidates.length === 1 && others.length === 1) moved.set(old, candidates[0]!);
    }
    for (const [old, now] of moved) put(present.get(now)!, old, false);
    const removed = new Set(missing.filter((path) => !moved.has(path)));
    for (let i = out.length - 1; i >= 0; i -= 1) {
      const path = linePath(out[i] ?? '', format);
      if (path !== null && removed.has(path)) {
        out.splice(i, 1);
        result.removed += 1;
      }
    }
    if (change.add) {
      const placed = new Set(moved.values());
      for (const path of fresh) if (!placed.has(path)) put(present.get(path)!, path, true);
    }
  }
  return result;
}
