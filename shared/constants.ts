/**
 * Constants shared by the client and the server.
 * The file imports no other modules: both Node (running .ts directly) and the Angular build execute it.
 */

/** Interface languages. Server messages are keyed by their English text, so English needs no dictionary. */
export const LANGS = ['en', 'uk', 'ru', 'de', 'pl', 'es', 'fr', 'it', 'ja', 'zh-CN', 'ko', 'cs', 'kk'] as const;
export const DEFAULT_LANG = 'en' satisfies (typeof LANGS)[number];
/** The `ui.language` value of a fresh installation: the interface follows the language of the system. */
export const AUTO_LANG = 'auto';

/** Chinese written in the traditional script: it is not served by the Simplified Chinese dictionary. */
const TRADITIONAL_CHINESE = /^zh-(?:hant|tw|hk|mo)\b/;

/**
 * The interface language for a list of preferred locales (`navigator.languages`, Electron's preferred system
 * languages), most wanted first: the first locale whose language has a dictionary wins; none gives English.
 */
export function matchLang(preferred: readonly string[]): (typeof LANGS)[number] {
  for (const raw of preferred) {
    const locale = String(raw).trim().toLowerCase().replace(/_/g, '-');
    if (!locale) continue;
    const exact = LANGS.find((lang) => lang.toLowerCase() === locale);
    if (exact) return exact;
    if (TRADITIONAL_CHINESE.test(locale)) continue;
    const primary = locale.split('-')[0];
    const byLanguage = LANGS.find((lang) => lang.toLowerCase().split('-')[0] === primary);
    if (byLanguage) return byLanguage;
  }
  return DEFAULT_LANG;
}

export const THEMES = ['dark', 'light'] as const;

/** CSV encodings that can be chosen in the settings. */
export const ENCODINGS = ['utf8', 'windows-1251', 'cp866', 'windows-1252', 'utf16le', 'shift_jis'] as const;
export const CSV_DELIMITERS = [',', ';', '\t'] as const;

/** Columns of the main table (except the checkbox). */
export const COLUMN_KEYS = ['name', 'path', 'size', 'csv', 'tags'] as const;

export const LOG_LEVELS = ['info', 'success', 'warn', 'error'] as const;

/** Extensions of cover images. */
export const IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'];

/**
 * Side files of disc images and other service files: never games, even when their extension is in the list of game
 * extensions (the console reads the .img / .iso / .pbp, not the .cue next to it). They are not listed in the library
 * and never added to the CSV.
 */
export const SERVICE_EXTENSIONS: readonly string[] = ['cue', 'ccd', 'sub', 'sbi', 'csv', 'bak', 'tmp', 'part', 'lst', 'xml', 'txt', 'nfo'];

/** API limits (the client checks them in advance, the server always does). */
export const MAX_GAME_FILES = 64;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
