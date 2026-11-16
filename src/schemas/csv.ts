import { z } from 'zod';
import { CSV_DELIMITERS, ENCODINGS } from '../../shared/constants.ts';
import { t } from '../i18n/index.ts';
import { defineInput } from '../middlewares/validate.ts';
import type { CsvPreviewRequest, CsvSaveRequest, MissingApplyRequest, SyncApplyRequest } from '../models/index.ts';
import { confirmed, diskPath } from './common.ts';
import type { Accepts, Assert } from './common.ts';

const MAX_ROWS = 500_000;
const MAX_COLUMNS = 1000;
const MAX_CELL_LENGTH = 65_536;

const csvPreviewBody = z.object({
  csvPath: diskPath.optional(),
  // The shared contract types these as plain strings; the values are still restricted to the supported ones.
  delimiter: z
    .string()
    .refine((value) => CSV_DELIMITERS.some((delimiter) => delimiter === value), { error: () => t('Invalid CSV delimiter') })
    .optional(),
  encoding: z
    .string()
    .refine((value) => ENCODINGS.some((encoding) => encoding === value), { error: () => t('Invalid CSV encoding') })
    .optional(),
  hasHeader: z.boolean().optional(),
});
const csvSaveBody = z.object({
  rows: z.array(z.array(z.string().max(MAX_CELL_LENGTH)).max(MAX_COLUMNS)).max(MAX_ROWS),
});
const missingApplyBody = z.object({
  expected: z.number().int().nonnegative(),
  confirmed: confirmed(() => t('Cleaning the CSV requires confirmation')),
});
const syncApplyBody = z.object({ confirmed: confirmed(() => t('Sync requires confirmation')) });

export const csvPreviewInput = defineInput({ body: csvPreviewBody });
export const csvSaveInput = defineInput({ body: csvSaveBody });
export const missingApplyInput = defineInput({ body: missingApplyBody });
export const syncApplyInput = defineInput({ body: syncApplyBody });

export type _CsvChecks = [
  Assert<Accepts<typeof csvPreviewBody, CsvPreviewRequest>>,
  Assert<Accepts<typeof csvSaveBody, CsvSaveRequest>>,
  Assert<Accepts<typeof missingApplyBody, MissingApplyRequest>>,
  Assert<Accepts<typeof syncApplyBody, SyncApplyRequest>>,
];
