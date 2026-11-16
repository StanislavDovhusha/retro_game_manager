import type { UpdateEntryRequest } from '@shared/api';
import type { LibraryFile } from '@shared/models';
import { hasUnsupportedChars } from '@shared/gameName';
import { MAX_TAG_LENGTH, findInvalidTag, formatTags, parseTags } from '@shared/tags';

/** The cells of the game table that can be edited in place. */
export type EditField = 'name' | 'short' | 'tags';

/** The cell that is being edited. */
export interface ActiveEdit {
  rel: string;
  field: EditField;
  draft: string;
  /** Why the value was not saved (shown under the field). */
  error: string | null;
  saving: boolean;
}

/** Dictionary keys of the messages shown when a typed value cannot be saved. */
export type EditErrorKey =
  | 'inlineEdit.errors.emptyName'
  | 'inlineEdit.errors.emptyShort'
  | 'inlineEdit.errors.shortSpace'
  | 'inlineEdit.errors.pipe'
  | 'inlineEdit.errors.tagTooLong'
  | 'inlineEdit.errors.renameFirst'
  | 'validation.latinOnly';

/** "|" separates the fields of the console's game lists (`*.lst`): titles and short names cannot contain it. */
const LIST_SEPARATOR = '|';

export type PreparedEdit =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; errorKey: EditErrorKey; params?: Record<string, string | number> }
  | { kind: 'save'; request: UpdateEntryRequest };

/** The text that goes into the input when the cell is opened for editing. */
export function initialDraft(game: LibraryFile, field: EditField): string {
  if (field === 'name') return game.title;
  if (field === 'short') return game.csvShort ?? '';
  return formatTags(game.tags);
}

/**
 * Turns what the user typed into a request. Nothing is sent when the value did not change.
 * A new title renames the game, so that request is confirmed here: typing the title and pressing Enter is the confirmation.
 */
export function prepareEdit(game: LibraryFile, field: EditField, draft: string): PreparedEdit {
  // Titles and short names are English only (`@shared/gameName`). An old title in another alphabet is kept, but it
  // has to be fixed first: its own cell does not save it unchanged, and the other cells of the game do not save.
  const oldTitle = hasUnsupportedChars(game.title);
  if (field === 'name') {
    const name = draft.trim();
    if (!name) return { kind: 'invalid', errorKey: 'inlineEdit.errors.emptyName' };
    if (name.includes(LIST_SEPARATOR)) return { kind: 'invalid', errorKey: 'inlineEdit.errors.pipe' };
    if (hasUnsupportedChars(name)) return { kind: 'invalid', errorKey: 'validation.latinOnly' };
    if (name === game.title) return { kind: 'unchanged' };
    return { kind: 'save', request: { rel: game.rel, name, confirmed: true } };
  }
  if (field === 'short') {
    const short = draft.trim();
    if (!short) return { kind: 'invalid', errorKey: 'inlineEdit.errors.emptyShort' };
    if (/\s/u.test(short)) return { kind: 'invalid', errorKey: 'inlineEdit.errors.shortSpace' };
    if (short.includes(LIST_SEPARATOR)) return { kind: 'invalid', errorKey: 'inlineEdit.errors.pipe' };
    if (hasUnsupportedChars(short)) return { kind: 'invalid', errorKey: 'validation.latinOnly' };
    if (short === (game.csvShort ?? '')) return { kind: 'unchanged' };
    if (oldTitle) return { kind: 'invalid', errorKey: 'inlineEdit.errors.renameFirst' };
    return { kind: 'save', request: { rel: game.rel, short } };
  }
  const tags = parseTags(draft); // a space separates the tags, so a typed tag can never contain one
  const bad = findInvalidTag(tags);
  if (bad) return { kind: 'invalid', errorKey: 'inlineEdit.errors.tagTooLong', params: { max: MAX_TAG_LENGTH, tag: bad.tag } };
  if (formatTags(tags) === formatTags(game.tags)) return { kind: 'unchanged' };
  if (oldTitle) return { kind: 'invalid', errorKey: 'inlineEdit.errors.renameFirst' };
  return { kind: 'save', request: { rel: game.rel, tags } };
}
