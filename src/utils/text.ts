import { hasUnsupportedChars } from '../../shared/gameName.ts';
import { t } from '../i18n/index.ts';
import { ValidationError } from './errors.ts';

/**
 * "The Legend of Zelda" -> "theLegendOfZelda".
 * Words are runs of letters and digits (any alphabet); punctuation and brackets are dropped.
 */
export function toCamelCase(text: unknown): string {
  // Apostrophes do not split words: "Link's" -> "links".
  const words =
    String(text ?? '')
      .normalize('NFC')
      .replace(/['’ʼ`]/g, '')
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/**
 * A safe file name made from a game title: no characters that are invalid on Windows or Unix, no leading or
 * trailing dots or spaces (the file would become hidden or could not be created on Windows). Cyrillic and other
 * letters are kept. An empty result means the title cannot be used as a file name.
 */
export function toSafeFileName(text: unknown, max = 150): string {
  const trim = (value: string): string => value.replace(/^[. ]+/, '').replace(/[. ]+$/, '');
  let name = trim(
    String(text ?? '')
      .normalize('NFC')
      // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' '),
  );
  if (name.length > max) name = trim(name.slice(0, max));
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `_${name}`;
  return name;
}

export const MAX_TITLE_LENGTH = 200;

/** Validates and normalizes a game title typed by the user (whitespace collapsed). */
export function normalizeTitle(title: unknown): string {
  const clean = String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) throw new ValidationError(t('The game title cannot be empty'));
  if (clean.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(t('The game title is too long (200 characters maximum)'));
  }
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is being rejected
  if (/[\u0000-\u001f]/.test(clean)) throw new ValidationError(t('The title contains invalid characters'));
  // "|" separates the fields of the console's game lists (allfiles.lst …): it cannot be written in a title.
  if (clean.includes('|')) throw new ValidationError(t('The title cannot contain the “|” character'));
  // Only English letters, digits, spaces and - _ ( ) [ ] . & # : (`shared/gameName.ts`, as in the client).
  if (hasUnsupportedChars(clean)) {
    throw new ValidationError(t('The title can contain only English letters, digits, spaces and the signs - _ ( ) [ ] . & # :'));
  }
  if (!toCamelCase(clean)) throw new ValidationError(t('The title needs at least one letter or digit'));
  return clean;
}
