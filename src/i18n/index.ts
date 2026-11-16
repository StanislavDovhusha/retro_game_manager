import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';
import { DEFAULT_LANG, LANGS } from '../../shared/constants.ts';
import type { Lang } from '../../shared/models.ts';
import type { TranslateParams } from '../models/index.ts';
import { cs } from './cs.ts';
import { de } from './de.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { it } from './it.ts';
import { ja } from './ja.ts';
import { kk } from './kk.ts';
import { ko } from './ko.ts';
import { pl } from './pl.ts';
import { ru } from './ru.ts';
import { uk } from './uk.ts';
import { zhCN } from './zhCN.ts';

export { DEFAULT_LANG, LANGS };

/** The key of a translation is its English source text, so English needs no dictionary. */
const DICTIONARIES: Record<Lang, Readonly<Record<string, string>> | null> = {
  en: null,
  uk,
  ru,
  de,
  pl,
  es,
  fr,
  it,
  ja,
  'zh-CN': zhCN,
  ko,
  cs,
  kk,
};

const storage = new AsyncLocalStorage<{ lang: Lang }>();
let fallback: Lang = DEFAULT_LANG;

export const isLang = (value: unknown): value is Lang => LANGS.some((lang) => lang === value);

/** Language used outside a request (console, tests) and for the `auto` setting (the desktop shell passes the system language). */
export function setFallbackLang(lang: unknown): void {
  if (isLang(lang)) fallback = lang;
}

export const currentLang = (): Lang => storage.getStore()?.lang ?? fallback;

/** Runs `fn` with the given language; the language is visible through the whole chain of async calls. */
export const runWithLang = <T>(lang: unknown, fn: () => T): T => storage.run({ lang: isLang(lang) ? lang : fallback }, fn);

/** Request language from the X-Lang header (English by default). */
export function langOf(req: Pick<Request, 'headers'>): Lang {
  const raw = String(req.headers['x-lang'] ?? '').toLowerCase();
  return LANGS.find((lang) => lang.toLowerCase() === raw) ?? DEFAULT_LANG;
}

/** Translates a message into the current request language; `{name}` placeholders are filled from `params`. */
export function t(key: string, params?: TranslateParams): string {
  const text = DICTIONARIES[currentLang()]?.[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;
}
