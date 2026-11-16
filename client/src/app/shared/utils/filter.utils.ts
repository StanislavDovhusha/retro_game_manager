import type { LibraryFile } from '@shared/models';
import { matchesGame, matchesName, matchesTags, searchKey, type SearchableGame } from '@shared/search';
import type { SearchScope, TreeNode } from '../models/ui.models';

/** What the search rules of `@shared/search` see of a game of the library. */
export const searchable = (game: LibraryFile): SearchableGame => ({ title: game.title, short: game.csvShort, fileName: game.fileName, tags: game.tags });

/**
 * Case-insensitive search in the chosen field (or in all of them). The title, short title and tag rules are the ones of
 * the global search in the header (`@shared/search`); the path, extension and folder scopes exist only here.
 */
export function matchGame(game: LibraryFile, query: string, scope: SearchScope): boolean {
  const key = searchKey(query);
  if (!key) return true;
  const has = (s: string) => s.toLowerCase().includes(key);
  switch (scope) {
    case 'name': return matchesName(searchable(game), key);
    case 'path': return has(game.rel);
    case 'ext': return has(game.ext);
    case 'dir': return has(game.dir);
    case 'tags': return matchesTags(searchable(game), key);
    default: return has(game.rel) || matchesGame(searchable(game), key);
  }
}

export function buildTree(files: LibraryFile[], dirs: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', dirs: [], files: [], total: 0 };
  const index = new Map<string, TreeNode>([['', root]]);

  const ensure = (path: string): TreeNode => {
    const found = index.get(path);
    if (found) return found;
    const cut = path.lastIndexOf('/');
    const parent = ensure(cut < 0 ? '' : path.slice(0, cut));
    const node: TreeNode = { name: path.slice(cut + 1), path, dirs: [], files: [], total: 0 };
    parent.dirs.push(node);
    index.set(path, node);
    return node;
  };

  dirs.forEach(ensure);
  files.forEach((file) => ensure(file.dir).files.push(file));

  const count = (node: TreeNode): number => {
    node.total = node.files.length + node.dirs.reduce((sum, dir) => sum + count(dir), 0);
    return node.total;
  };
  count(root);
  return root;
}

export const isInDir = (game: LibraryFile, dir: string | null): boolean =>
  dir === null || game.dir === dir || game.dir.startsWith(`${dir}/`);

/** Key for comparing paths: slashes, case and a leading "./" do not matter. */
export const pathKey = (value: string): string =>
  value.trim().replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '').replace(/\/{2,}/g, '/').toLowerCase();

/** Indexes of duplicate rows (the first occurrence is kept). Empty paths are never duplicates. */
export function findDuplicateRows(rows: string[][], keyCol: number): Set<number> {
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  rows.forEach((row, i) => {
    const key = pathKey(row[keyCol] ?? '');
    if (!key) return;
    if (seen.has(key)) duplicates.add(i);
    else seen.add(key);
  });
  return duplicates;
}
