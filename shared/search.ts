/**
 * Game search: one set of rules for the filter of the open folder and for the global search over every platform
 * folder of the card. Case-insensitive substring search in the title, the short title, the file name and the tags.
 * The file imports no other modules: both Node and the Angular build execute it.
 */

/** What a game offers to the search. */
export interface SearchableGame {
  /** Display title (the CSV title, or the file name without the extension). */
  title: string;
  /** Short title from the CSV (null or '' when there is none). */
  short: string | null;
  fileName: string;
  tags: readonly string[];
}

/** How many results the drop-down list under the search field shows. */
export const SEARCH_DROPDOWN_LIMIT = 20;
/** Pause after the last key press before the search runs. */
export const SEARCH_DEBOUNCE_MS = 300;

/** The query as it is compared: trimmed and lower-case. */
export const searchKey = (query: string): string => query.trim().toLowerCase();

const has = (text: string | null | undefined, key: string): boolean => typeof text === 'string' && text.toLowerCase().includes(key);

/** The title, the short title or the file name contains the query. */
export const matchesName = (game: SearchableGame, key: string): boolean =>
  has(game.title, key) || has(game.short, key) || has(game.fileName, key);

/** One of the tags contains the query. */
export const matchesTags = (game: SearchableGame, key: string): boolean => game.tags.some((tag) => has(tag, key));

/** The game matches the query (an empty query matches everything). `key` comes from `searchKey`. */
export const matchesGame = (game: SearchableGame, key: string): boolean => !key || matchesName(game, key) || matchesTags(game, key);

/**
 * Relevance: a title that starts with the query first, then a word of the title that starts with it, then the title
 * containing it anywhere, then the short title or the file name, then the tags. Lower is better.
 */
export function searchRank(game: SearchableGame, key: string): number {
  const title = game.title.toLowerCase();
  if (title.startsWith(key)) return 0;
  const at = title.indexOf(key);
  if (at > 0 && !/[\p{L}\p{N}]/u.test(title.charAt(at - 1))) return 1;
  if (at > 0) return 2;
  if (has(game.short, key) || has(game.fileName, key)) return 3;
  return 4;
}

/** The games that match the query, the most relevant first; games of equal rank keep their order. */
export function searchGames<T extends SearchableGame>(games: readonly T[], query: string): T[] {
  const key = searchKey(query);
  if (!key) return [];
  const hits: { game: T; rank: number; index: number }[] = [];
  games.forEach((game, index) => {
    if (matchesGame(game, key)) hits.push({ game, rank: searchRank(game, key), index });
  });
  hits.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return hits.map((hit) => hit.game);
}
