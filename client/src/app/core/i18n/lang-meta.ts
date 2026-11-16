import type { Lang } from '@shared/models';

/** Static description of a UI language. */
export interface LangMeta {
  code: Lang;
  /** Caption on the language switcher button. */
  label: string;
  /** Language name written in that language. */
  name: string;
  /** Locale used to format numbers and dates. */
  locale: string;
}

export const LANG_META: readonly LangMeta[] = [
  { code: 'en', label: 'EN', name: 'English', locale: 'en-US' },
  { code: 'uk', label: 'UK', name: 'Українська', locale: 'uk-UA' },
  { code: 'ru', label: 'RU', name: 'Русский', locale: 'ru-RU' },
  { code: 'de', label: 'DE', name: 'Deutsch', locale: 'de-DE' },
  { code: 'pl', label: 'PL', name: 'Polski', locale: 'pl-PL' },
  { code: 'es', label: 'ES', name: 'Español', locale: 'es-ES' },
  { code: 'fr', label: 'FR', name: 'Français', locale: 'fr-FR' },
  { code: 'it', label: 'IT', name: 'Italiano', locale: 'it-IT' },
  { code: 'ja', label: 'JA', name: '日本語', locale: 'ja-JP' },
  { code: 'zh-CN', label: 'ZH', name: '简体中文', locale: 'zh-CN' },
  { code: 'ko', label: 'KO', name: '한국어', locale: 'ko-KR' },
  { code: 'cs', label: 'CS', name: 'Čeština', locale: 'cs-CZ' },
  { code: 'kk', label: 'KK', name: 'Қазақша', locale: 'kk-KZ' },
];
