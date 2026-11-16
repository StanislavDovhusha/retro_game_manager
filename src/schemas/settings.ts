import { z } from 'zod';
import { AUTO_LANG, CSV_DELIMITERS, ENCODINGS, LANGS, THEMES } from '../../shared/constants.ts';
import type { SettingsPatch } from '../models/index.ts';
import { defineInput } from '../middlewares/validate.ts';
import { diskPath } from './common.ts';
import type { Accepts, Assert } from './common.ts';

const shortText = z.string().max(256);
/** A local calendar day `YYYY-MM-DD`, or '' (not recorded). */
const localDay = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/);

/** A change of the settings: any of the fields; nested objects are merged with the current ones. */
export const settingsPatchSchema = z.object({
  device: z.string().max(64).optional(),
  gamesDir: diskPath.optional(),
  imagesDir: diskPath.optional(),
  csvPath: diskPath.optional(),
  sdRoot: diskPath.optional(),
  platform: z.string().max(255).optional(),
  csv: z
    .object({
      delimiter: z.enum(CSV_DELIMITERS),
      encoding: z.enum(ENCODINGS),
      hasHeader: z.boolean(),
      pathPrefix: z.string().max(1024),
      columns: z.object({ path: shortText, name: shortText, short: shortText, tags: shortText }).partial(),
    })
    .partial()
    .optional(),
  extensions: z.array(z.string().max(32)).max(500).optional(),
  emulatorPath: diskPath.optional(),
  theme: z.enum(THEMES).optional(),
  updates: z
    .object({ checkOnStartup: z.boolean(), dismissedVersion: z.string().max(64) })
    .partial()
    .optional(),
  ui: z
    .object({
      columnWidths: z
        .object({ name: z.number(), file: z.number(), path: z.number(), size: z.number(), csv: z.number(), tags: z.number() })
        .partial(),
      hiddenPanels: z.object({ left: z.boolean(), games: z.boolean(), right: z.boolean() }).partial(),
      language: z.enum([...LANGS, AUTO_LANG]),
      foldersShare: z.number().min(0).max(1),
      donate: z
        .object({
          autoShow: z.boolean(),
          counter: z.number().int().min(0).max(100_000),
          threshold: z.number().int().min(0).max(100),
          firstLaunch: localDay,
          usageDays: z.number().int().min(0).max(100_000),
          lastUsageDay: localDay,
          lastShownAt: z.number().int().min(0),
        })
        .partial(),
      tourDone: z.boolean(),
      compressZip: z.boolean(),
    })
    .partial()
    .optional(),
});

export const updateSettingsInput = defineInput({ body: settingsPatchSchema });

type _SettingsPatchIsAccepted = Assert<Accepts<typeof settingsPatchSchema, SettingsPatch>>;
export type { _SettingsPatchIsAccepted };
