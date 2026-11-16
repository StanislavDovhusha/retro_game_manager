import type { Lang } from '@shared/models';

/**
 * The order of the language menu, in groups. The groups only set the order and keep related languages together in
 * one column (see `splitIntoColumns`); the menu shows no headings or dividers between them. Every interface language
 * is listed exactly once (a test checks it).
 */
export const LANGUAGE_GROUPS: readonly (readonly Lang[])[] = [
  ['en', 'de', 'es', 'fr', 'it'],
  ['uk', 'pl', 'cs', 'ru', 'kk'],
  ['ja', 'zh-CN', 'ko'],
];

/** Columns of the menu in a window at least `TWO_COLUMN_MIN_WIDTH` pixels wide; a narrower window gets one column. */
export const MENU_COLUMNS = 2;
export const TWO_COLUMN_MIN_WIDTH = 480;
