import type { LibraryFile } from '@shared/models';
import type { SortState } from '../models/ui.models';

// Not in CSV → in CSV without values → in CSV with a value.
const csvRank = (game: LibraryFile) => (game.inCsv ? (game.csvShort || game.csvName ? 2 : 1) : 0);
const csvText = (game: LibraryFile) => game.csvShort || game.csvName || '';

/** Sorts in both directions; ties keep a stable order (by path). */
export function sortGames(games: LibraryFile[], { key, dir }: SortState, locale: string): LibraryFile[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sign = dir === 'asc' ? 1 : -1;
  const compare =
    key === 'size' ? (a: LibraryFile, b: LibraryFile) => a.size - b.size
    : key === 'csv' ? (a: LibraryFile, b: LibraryFile) => csvRank(a) - csvRank(b) || collator.compare(csvText(a), csvText(b))
    : (a: LibraryFile, b: LibraryFile) => collator.compare(a.title, b.title);
  return [...games].sort((a, b) => sign * compare(a, b) || collator.compare(a.rel, b.rel));
}
