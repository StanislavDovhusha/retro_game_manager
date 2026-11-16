import type { LibraryFile } from '@shared/models';

/** Where to search when filtering the game list. */
export type SearchScope = 'all' | 'name' | 'path' | 'ext' | 'dir' | 'tags';
export type SortKey = 'name' | 'size' | 'csv';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** A node of the games folder tree. */
export interface TreeNode {
  name: string;
  path: string;
  dirs: TreeNode[];
  files: LibraryFile[];
  /** Number of games in the folder and in all nested folders. */
  total: number;
}
