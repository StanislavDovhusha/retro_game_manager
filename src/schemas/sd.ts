import { z } from 'zod';
import type { SdPlatformRequest, SdRootRequest } from '../models/index.ts';
import { defineInput } from '../middlewares/validate.ts';
import { t } from '../i18n/index.ts';
import { diskPath, relPathOrRoot } from './common.ts';
import type { Accepts, Assert } from './common.ts';

const sdRootBody = z.object({
  root: z
    .string()
    .trim()
    .pipe(diskPath)
    .refine((value) => value.length > 0, { error: () => t('The SD card root is not selected') }),
});
const sdPlatformBody = z.object({ name: z.string().min(1).max(255) });
const sdTreeQuery = z.object({ rel: relPathOrRoot.optional() });

export const sdRootInput = defineInput({ body: sdRootBody });
export const sdPlatformInput = defineInput({ body: sdPlatformBody });
export const sdTreeInput = defineInput({ query: sdTreeQuery });

export type _SdChecks = [Assert<Accepts<typeof sdRootBody, SdRootRequest>>, Assert<Accepts<typeof sdPlatformBody, SdPlatformRequest>>];
