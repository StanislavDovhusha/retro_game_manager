/**
 * The characters a game title and a short name may contain: English (Latin) letters A–Z and a–z, digits, the space,
 * the hyphen and the underscore, round and square brackets, the dot, `&`, `#` and the colon. The console shows other alphabets (Cyrillic, Japanese,
 * Chinese, Korean…) wrongly, so they are refused. Used by the client (the fields filter what is typed or pasted, the
 * table marks old titles) and by the server (requests are checked again). Pure, no imports.
 */

/** One allowed character. */
export const NAME_CHAR = /[A-Za-z0-9 \-_()[\].&#:]/;

const UNSUPPORTED = /[^A-Za-z0-9 \-_()[\].&#:]/;
const UNSUPPORTED_ALL = /[^A-Za-z0-9 \-_()[\].&#:]/g;

/** Whether the text has a character a title or short name may not contain. */
export const hasUnsupportedChars = (text: string): boolean => UNSUPPORTED.test(text);

/**
 * The text without the characters that are not allowed. Letters with accents lose the accent first (`Pokémon` →
 * `Pokemon`), tabs and line breaks become spaces; everything else that is not allowed is dropped. Spaces are not
 * trimmed or collapsed, so the text can be filtered while it is typed.
 */
export function stripUnsupportedChars(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s/g, ' ').replace(UNSUPPORTED_ALL, '');
}

/** A title made from other text (a file name): the allowed characters only, spaces collapsed and trimmed. */
export function cleanTitle(text: string): string {
  return stripUnsupportedChars(text).replace(/ {2,}/g, ' ').trim();
}
