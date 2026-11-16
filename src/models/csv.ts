import type { CsvColumnNames } from '../../shared/models.ts';

/** A CSV held in memory. The file structure is not assumed: every field is kept as a string. */
export interface CsvTable {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  hadBom: boolean;
  eol: '\n' | '\r\n';
  delimiter: string;
  encoding: string;
  exists: boolean;
}

export interface CsvReadOptions {
  delimiter: string;
  encoding: string;
  hasHeader: boolean;
  /** How a file that does not exist yet is written (the console's own format, from its profile). */
  newFile?: { bom: boolean; eol: '\r\n' | '\n' };
}

/** Column indexes (-1: there is no such column). */
export interface ResolvedColumns {
  path: number;
  name: number;
  short: number;
  tags: number;
}

/** A CSV row that belongs to the managed folder. */
export interface CsvEntry {
  index: number;
  rel: string;
  raw: string;
}

export interface StaleEntry {
  index: number;
  path: string;
}

export interface SyncPlan {
  idx: ResolvedColumns;
  toAdd: string[];
  stale: StaleEntry[];
  unchanged: number;
  unmanaged: number;
  duplicates: number;
  /** The CSV does not exist yet or holds no rows: it is created from the games of the folder. */
  created: boolean;
  /** Rows (kept by the sync) that have no tags column yet. */
  tagsColumnAdded: number;
}

export interface CsvNames {
  name: string;
  short: string;
}

/** What the CSV knows about a game: the titles and the tags. */
export interface CsvRecord extends CsvNames {
  tags: string[];
}

export type CsvColumnsConfig = Partial<CsvColumnNames>;
