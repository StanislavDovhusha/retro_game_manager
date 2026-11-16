import type { PublicSettings } from '../../shared/models.ts';

/** Values substituted into translated messages: `{name}` in the text is replaced by the value. */
export type TranslateParams = Record<string, string | number | null>;

/** All settings: the public ones plus manual image bindings (never sent to the client). */
export interface Settings extends PublicSettings {
  /** Game path relative to the games folder -> absolute path of the chosen image. */
  imageOverrides: Record<string, string>;
}
