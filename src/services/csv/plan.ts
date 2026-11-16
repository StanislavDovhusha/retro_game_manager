import { formatTags, parseTags } from '../../../shared/tags.ts';
import { t } from '../../i18n/index.ts';
import type {
  CsvColumnNames,
  CsvEntry,
  CsvNames,
  CsvRecord,
  CsvTable,
  GameFile,
  ResolvedColumns,
  StaleEntry,
  SyncPlan,
} from '../../models/index.ts';
import { BadRequestError } from '../../utils/errors.ts';
import { baseNoExt, normalizeRel } from '../../utils/paths.ts';
import { toCamelCase } from '../../utils/text.ts';

/** Without a header the tags are the 4th column. Rows that are shorter simply have no tags. */
const TAGS_DEFAULT_INDEX = 3;

/**
 * Column mapping. The path is column 1 by default. For a CSV without a header the defaults are column 2 for the
 * full title, column 3 for the short title and column 4 for the tags (a row may have fewer columns: then the tags
 * are empty). The image column is used only when named explicitly.
 */
export function resolveColumns(csv: CsvTable, columns: Partial<CsvColumnNames> = {}): ResolvedColumns {
  if (!csv.headers.length) throw new BadRequestError(t('The CSV has no columns — check the file structure in the settings'));
  const find = (label: string, name: string): number => {
    const index = csv.headers.indexOf(name);
    if (index < 0) throw new BadRequestError(t('Column “{name}” ({label}) was not found in the CSV', { name, label }));
    return index;
  };
  const auto = (index: number): number => (!csv.hasHeader && index < csv.headers.length ? index : -1);
  return {
    path: columns.path ? find(t('file path'), columns.path) : 0,
    name: columns.name ? find(t('game title'), columns.name) : auto(1),
    short: columns.short ? find(t('short name'), columns.short) : auto(2),
    tags: columns.tags ? find(t('tags'), columns.tags) : csv.hasHeader ? -1 : TAGS_DEFAULT_INDEX,
  };
}

function prefixInfo(prefix: unknown): { norm: string; lower: string } {
  let norm = normalizeRel(prefix);
  if (norm && !norm.endsWith('/')) norm += '/';
  return { norm, lower: norm.toLowerCase() };
}

/**
 * Splits the CSV rows into those that belong to the managed folder and the rest.
 * Entries outside the prefix or with an empty path are never changed.
 */
export function parseEntries(csv: CsvTable, pathIdx: number, prefix: unknown): { entries: CsvEntry[]; unmanaged: number } {
  const info = prefixInfo(prefix);
  const entries: CsvEntry[] = [];
  let unmanaged = 0;
  csv.rows.forEach((row, index) => {
    const raw = String(row[pathIdx] ?? '');
    const value = normalizeRel(raw);
    if (!value || (info.norm && !value.toLowerCase().startsWith(info.lower))) {
      unmanaged += 1;
      return;
    }
    entries.push({ index, rel: value.slice(info.norm.length), raw });
  });
  return { entries, unmanaged };
}

export interface BuildPlanInput {
  csv: CsvTable;
  columns: Partial<CsvColumnNames>;
  prefix: string;
  files: Pick<GameFile, 'rel'>[];
  /** Checks that a file really exists on disk: a CSV entry is dropped only when the file is gone entirely. */
  fileExists: (rel: string) => Promise<boolean>;
}

/** Builds the sync plan (changes nothing). */
export async function buildPlan({ csv, columns, prefix, files, fileExists }: BuildPlanInput): Promise<SyncPlan> {
  const idx = resolveColumns(csv, columns);
  const { entries, unmanaged } = parseEntries(csv, idx.path, prefix);

  const exact = new Set(files.map((file) => file.rel));
  const lower = new Map(files.map((file) => [file.rel.toLowerCase(), file.rel]));

  const matched = new Set<string>();
  const stale: StaleEntry[] = [];
  let unchanged = 0;
  let duplicates = 0;

  for (const entry of entries) {
    const fileRel = exact.has(entry.rel) ? entry.rel : lower.get(entry.rel.toLowerCase());
    if (fileRel) {
      if (matched.has(fileRel)) duplicates += 1;
      matched.add(fileRel);
      unchanged += 1;
    } else if (await fileExists(entry.rel)) {
      unchanged += 1; // the file exists but has a non-game extension: leave it alone
    } else {
      stale.push({ index: entry.index, path: entry.raw });
    }
  }

  const toAdd = files.filter((file) => !matched.has(file.rel)).map((file) => file.rel);
  // A file that does not exist (or holds no rows) is created from the games of the folder.
  const created = !csv.exists || (csv.rows.length === 0 && !(csv.hasHeader && csv.headers.length > 0));
  const staleSet = new Set(stale.map((entry) => entry.index));
  const tagsColumnAdded = csv.rows.filter((row, index) => !staleSet.has(index) && needsTagsColumn(csv, idx, row)).length;
  return { idx, toAdd, stale, unchanged, unmanaged, duplicates, created, tagsColumnAdded };
}

/**
 * The console's filelist.csv has no header and three columns; the tags are the 4th. A row of such a file that is
 * shorter than the tags column gets it (empty) on sync, so every row has the same structure. A file with a header
 * keeps its own columns.
 */
function needsTagsColumn(csv: Pick<CsvTable, 'hasHeader'>, idx: ResolvedColumns, row: readonly string[]): boolean {
  return !csv.hasHeader && idx.tags >= 0 && row.length <= idx.tags;
}

/** The row with the empty tags column added (and the cells before it, if the row was even shorter). */
function withTagsColumn(row: string[], tagsIndex: number): string[] {
  const out = row.slice();
  while (out.length <= tagsIndex) out.push('');
  return out;
}

export interface ApplyPlanOptions {
  prefix: string;
  nameFor?: (rel: string) => CsvNames;
  /** Give the rows without a tags column an empty one (sync). */
  addTagsColumn?: boolean;
}

/**
 * Applies a plan to the CSV in memory and returns a new CSV object. With `addTagsColumn` (sync) the rows of a
 * headerless file that have no tags column get an empty one; the other cells are not touched.
 */
export function applyPlan(
  csv: CsvTable,
  plan: Pick<SyncPlan, 'idx' | 'toAdd' | 'stale'>,
  { prefix, nameFor, addTagsColumn = false }: ApplyPlanOptions,
): CsvTable {
  const staleSet = new Set(plan.stale.map((entry) => entry.index));
  const kept = csv.rows
    .filter((_, index) => !staleSet.has(index))
    .map((row) => (addTagsColumn && needsTagsColumn(csv, plan.idx, row) ? withTagsColumn(row, plan.idx.tags) : row));

  const backslashes = csv.rows.filter((row) => String(row[plan.idx.path] ?? '').includes('\\')).length;
  const useBackslash = backslashes > csv.rows.length / 2;
  let outPrefix = String(prefix ?? '');
  if (outPrefix && !/[\\/]$/.test(outPrefix)) outPrefix += useBackslash ? '\\' : '/';

  // New rows of a headerless file have every column, the (empty) tags included.
  const width = csv.hasHeader ? csv.headers.length : Math.max(csv.headers.length, plan.idx.tags + 1);
  const headers = csv.hasHeader ? csv.headers : Array.from({ length: width }, (_, i) => csv.headers[i] ?? t('Column {v0}', { v0: i + 1 }));
  const added = plan.toAdd.map((rel) => {
    const row: string[] = Array.from({ length: width }, () => '');
    const shown = useBackslash ? rel.replace(/\//g, '\\') : rel;
    row[plan.idx.path] = outPrefix + shown;
    const base = baseNoExt(rel.split('/').pop() ?? rel);
    const names: CsvNames = nameFor?.(rel) ?? { name: base, short: toCamelCase(base) };
    if (plan.idx.name >= 0) row[plan.idx.name] = names.name;
    if (plan.idx.short >= 0) row[plan.idx.short] = names.short;
    return row;
  });

  return { ...csv, headers, rows: [...kept, ...added] };
}

/** Removes every CSV entry that points at the listed files (in a single pass). */
export function removeEntries(
  csv: CsvTable,
  columns: Partial<CsvColumnNames>,
  prefix: string,
  rels: string[],
): { csv: CsvTable; removed: number } {
  const idx = resolveColumns(csv, columns);
  const { entries } = parseEntries(csv, idx.path, prefix);
  const targets = new Set(rels.map((rel) => normalizeRel(rel).toLowerCase()));
  const drop = new Set(entries.filter((entry) => targets.has(entry.rel.toLowerCase())).map((entry) => entry.index));
  if (!drop.size) return { csv, removed: 0 };
  return { csv: { ...csv, rows: csv.rows.filter((_, index) => !drop.has(index)) }, removed: drop.size };
}

export const removeEntry = (csv: CsvTable, columns: Partial<CsvColumnNames>, prefix: string, rel: string) =>
  removeEntries(csv, columns, prefix, [rel]);

/**
 * CSV data for every file: the full and the short title and the tags (empty or missing values become '' / []).
 * The key is the relative path in lower case.
 */
export function csvLookup(csv: CsvTable, columns: Partial<CsvColumnNames>, prefix: string): Map<string, CsvRecord> {
  const idx = resolveColumns(csv, columns);
  const { entries } = parseEntries(csv, idx.path, prefix);
  const cell = (row: string[], index: number): string => (index >= 0 ? String(row[index] ?? '').trim() : '');
  const map = new Map<string, CsvRecord>();
  for (const entry of entries) {
    const row = csv.rows[entry.index] ?? [];
    const name = cell(row, idx.name);
    const short = cell(row, idx.short);
    const tags = parseTags(cell(row, idx.tags));
    const key = entry.rel.toLowerCase();
    const prev = map.get(key);
    if (!prev) map.set(key, { name, short, tags });
    else {
      if (!prev.name && name) prev.name = name;
      if (!prev.short && short) prev.short = short;
      if (!prev.tags.length && tags.length) prev.tags = tags;
    }
  }
  return map;
}

/** Sets a cell, growing the row when it is shorter than the column index. */
function setCell(row: string[], index: number, value: string): void {
  if (index < 0) return;
  while (row.length <= index) row.push('');
  row[index] = value;
}

/**
 * Writes the tags (`tag1 tag2`). A row that has no tags column yet is not made longer just to hold an empty value,
 * so the entries without tags stay exactly as they were.
 */
function setTags(row: string[], index: number, tags: readonly string[]): void {
  const value = formatTags(tags);
  if (!value && row.length <= index) return;
  setCell(row, index, value);
}

/** The fields of an entry that can be changed together; undefined means "leave as is". */
export interface EntryFields {
  name?: string;
  short?: string;
  tags?: readonly string[];
}

function applyFields(row: string[], idx: ResolvedColumns, fields: EntryFields): void {
  if (fields.name !== undefined) setCell(row, idx.name, fields.name);
  if (fields.short !== undefined) setCell(row, idx.short, fields.short);
  if (fields.tags !== undefined) setTags(row, idx.tags, fields.tags);
}

/** The columns an update needs must exist: a CSV with a header has to name them in the settings. */
function assertColumnsFor(idx: ResolvedColumns, fields: EntryFields): void {
  if (fields.name !== undefined && idx.name < 0)
    throw new BadRequestError(t('The CSV has no column for the game title — choose it in the settings'));
  if (fields.short !== undefined && idx.short < 0)
    throw new BadRequestError(t('The CSV has no column for the short name — choose it in the settings'));
  if (fields.tags !== undefined && idx.tags < 0)
    throw new BadRequestError(t('The CSV has no column for the tags — choose it in the settings'));
}

/** Changes the given fields of an existing entry (every row with this path). `updated` is the number of rows changed. */
export function updateEntryFields(
  csv: CsvTable,
  columns: Partial<CsvColumnNames>,
  prefix: string,
  rel: string,
  fields: EntryFields,
): { csv: CsvTable; updated: number } {
  const idx = resolveColumns(csv, columns);
  assertColumnsFor(idx, fields);
  const { entries } = parseEntries(csv, idx.path, prefix);
  const key = normalizeRel(rel).toLowerCase();
  const found = entries.filter((entry) => entry.rel.toLowerCase() === key);
  if (!found.length) return { csv, updated: 0 };
  const rows = csv.rows.map((row) => row.slice());
  for (const entry of found) {
    const row = rows[entry.index];
    if (row) applyFields(row, idx, fields);
  }
  return { csv: { ...csv, rows }, updated: found.length };
}

/**
 * Adds a game to the CSV or, when an entry with this path already exists, updates it in place, so no duplicates
 * appear. The other columns of existing entries are not touched.
 */
export function upsertGame(
  csv: CsvTable,
  columns: Partial<CsvColumnNames>,
  prefix: string,
  { rel, name, short, tags }: { rel: string; name: string; short: string; tags?: readonly string[] },
): { csv: CsvTable; mode: 'added' | 'updated' } {
  const idx = resolveColumns(csv, columns);
  const { entries } = parseEntries(csv, idx.path, prefix);
  const key = normalizeRel(rel).toLowerCase();
  const found = entries.filter((entry) => entry.rel.toLowerCase() === key);

  if (found.length) {
    const rows = csv.rows.map((row) => row.slice());
    for (const entry of found) {
      const row = rows[entry.index];
      if (!row) continue;
      applyFields(row, idx, { name, short, tags });
    }
    return { csv: { ...csv, rows }, mode: 'updated' };
  }

  const next = applyPlan(csv, { idx, toAdd: [rel], stale: [] }, { prefix, nameFor: () => ({ name, short }) });
  const added = next.rows[next.rows.length - 1];
  if (added && tags?.length) setTags(added, idx.tags, tags);
  return { csv: next, mode: 'added' };
}

/**
 * Renames a game entry: changes the file name in the path column (the folder and the prefix are kept); the full
 * and short titles are computed by `compute` from their previous values. The source object is not modified.
 */
export function renameEntry(
  csv: CsvTable,
  columns: Partial<CsvColumnNames>,
  prefix: string,
  oldRel: string,
  newFileName: string,
  compute: (old: { name: string; short: string }) => { name: string; short: string; tags?: readonly string[] },
): { csv: CsvTable; renamed: number } {
  const idx = resolveColumns(csv, columns);
  const { entries } = parseEntries(csv, idx.path, prefix);
  const key = normalizeRel(oldRel).toLowerCase();
  const found = entries.filter((entry) => entry.rel.toLowerCase() === key);
  if (!found.length) return { csv, renamed: 0 };
  const rows = csv.rows.map((row) => row.slice());
  for (const entry of found) {
    const row = rows[entry.index];
    if (!row) continue;
    const dir = /^(.*[\\/])?[^\\/]*$/.exec(entry.raw)?.[1] ?? '';
    setCell(row, idx.path, dir + newFileName);
    const next = compute({
      name: idx.name >= 0 ? String(row[idx.name] ?? '') : '',
      short: idx.short >= 0 ? String(row[idx.short] ?? '') : '',
    });
    setCell(row, idx.name, next.name);
    setCell(row, idx.short, next.short);
    if (next.tags !== undefined) setTags(row, idx.tags, next.tags);
  }
  return { csv: { ...csv, rows }, renamed: found.length };
}
