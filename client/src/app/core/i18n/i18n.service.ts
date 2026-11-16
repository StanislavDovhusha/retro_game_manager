import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LANGS, matchLang } from '@shared/constants';
import type { Lang } from '@shared/models';
import { LANG_META, type LangMeta } from './lang-meta';

export type TranslateParams = Record<string, string | number>;

const STORAGE_KEY = 'game-manager.lang';
const isLang = (value: unknown): value is Lang => LANGS.some((lang) => lang === value);

/** The language of the system (the browser's preferred languages) when it has a dictionary, otherwise English. */
export function systemLang(): Lang {
  try {
    return matchLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
  } catch { /* no navigator */ }
  return matchLang([]);
}

/** The language of the first render: the one chosen earlier, or the language of the system on the first start. */
function readStoredLang(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isLang(value)) return value;
  } catch { /* storage is unavailable */ }
  return systemLang();
}

/**
 * Interface language. Translations are provided by ngx-translate (public/i18n/*.json).
 * Keys are English identifiers such as `settings.title`; en.json is the primary dictionary
 * and the fallback for every other language.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);

  /** Current language (a signal, so number/date formatting and templates react to a change). */
  readonly lang = signal<Lang>(readStoredLang());
  readonly meta = computed<LangMeta>(() => LANG_META.find((l) => l.code === this.lang()) ?? LANG_META[0]!);
  readonly locale = computed(() => this.meta().locale);

  /** Loads the dictionary of the stored language before the first render. */
  async init(): Promise<void> {
    await this.apply(this.lang());
  }

  async setLang(lang: Lang): Promise<void> {
    if (!isLang(lang)) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    await this.apply(lang);
  }

  private async apply(lang: Lang): Promise<void> {
    await firstValueFrom(this.translate.use(lang));
    this.lang.set(lang);
    document.documentElement.lang = lang;
  }

  /** Translates a key from code (templates use the `translate` pipe). */
  t(key: string, params?: TranslateParams): string {
    this.lang(); // dependency: the result is recomputed when the language changes
    return this.translate.instant(key, params);
  }

  /**
   * Picks the plural form of a word. The dictionary holds `<baseKey>.<category>` entries
   * (one, few, many, other) following the CLDR plural categories of the current language.
   */
  plural(baseKey: string, count: number): string {
    this.lang();
    const category = new Intl.PluralRules(this.locale()).select(count);
    const key = `${baseKey}.${category}`;
    const text = this.translate.instant(key);
    return text === key ? this.translate.instant(`${baseKey}.other`) : text;
  }
}
