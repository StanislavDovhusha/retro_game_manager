/**
 * Tags of a game: the 4th column of filelist.csv, written as `tag1 tag2 tag3`. A space separates the tags, so a tag
 * can never contain one. Pure functions without imports: the client, the server and the tests all use them.
 */

/** Any whitespace character (space, tab, no-break space …) separates tags. */
const WHITESPACE = /\s+/u;
const HAS_WHITESPACE = /\s/u;
/** A sane limit for one tag and for the whole list. */
export const MAX_TAG_LENGTH = 64;
export const MAX_TAGS = 50;

/** Tags without empty ones and duplicates (the first one stays); the order is kept. The tags are not split. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** The text of a CSV cell or of an input field → tags: split on whitespace, trimmed, no empty tags, no duplicates. */
export const parseTags = (text: string): string[] => normalizeTags(text.split(WHITESPACE));

/** Tags → the CSV cell: `tag1 tag2 tag3`. */
export const formatTags = (tags: readonly string[]): string => normalizeTags(tags).join(' ');

/** The first tag that cannot be saved (it contains a space, or it is too long); null when all are fine. */
export function findInvalidTag(tags: readonly string[]): { tag: string; reason: 'space' | 'length' } | null {
  for (const raw of tags) {
    const tag = raw.trim();
    if (HAS_WHITESPACE.test(tag)) return { tag, reason: 'space' };
    if (tag.length > MAX_TAG_LENGTH) return { tag, reason: 'length' };
  }
  return null;
}
