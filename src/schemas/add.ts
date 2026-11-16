import { z } from 'zod';
import { MAX_GAME_FILES } from '../../shared/constants.ts';
import { t } from '../i18n/index.ts';
import { defineInput } from '../middlewares/validate.ts';
import type { AddGameRequest, InspectRequest, InspectSetRequest, PickFileRequest } from '../models/index.ts';
import { diskPath, gameTitle, sourceRef } from './common.ts';
import type { Accepts, Assert } from './common.ts';

// `kind` defaults to "game", as the API always did.
const inspectBody = z.object({ kind: z.enum(['game', 'image']).default('game'), path: diskPath });
const inspectSetBody = z.object({
  paths: z
    .array(diskPath.refine((value) => value.length > 0))
    .max(MAX_GAME_FILES)
    .refine((list) => list.length > 0, { error: () => t('No files selected') }),
});
const uploadQuery = z.object({ kind: z.enum(['game', 'image']) });
const uploadHeaders = z.object({
  'x-file-name': z.string().min(1, { message: 'the X-File-Name header is required' }).max(2048),
});
const uploadParams = z.object({ id: z.string().min(1).max(100) });
const addGameBody = z.object({
  game: z.union([sourceRef, z.array(sourceRef).min(1).max(MAX_GAME_FILES)]),
  title: gameTitle,
  image: sourceRef.nullable().default(null),
  compress: z.boolean().default(false),
});
const dialogFileBody = z.object({ kind: z.enum(['csv', 'image', 'game', 'emulator']), multiple: z.boolean().optional() });

export const inspectInput = defineInput({ body: inspectBody });
export const inspectSetInput = defineInput({ body: inspectSetBody });
export const uploadInput = defineInput({ query: uploadQuery, headers: uploadHeaders });
export const discardUploadInput = defineInput({ params: uploadParams });
export const addGameInput = defineInput({ body: addGameBody });
export const dialogFileInput = defineInput({ body: dialogFileBody });

export type _AddChecks = [
  Assert<Accepts<typeof inspectBody, InspectRequest>>,
  Assert<Accepts<typeof inspectSetBody, InspectSetRequest>>,
  Assert<Accepts<typeof addGameBody, AddGameRequest>>,
  Assert<Accepts<typeof dialogFileBody, PickFileRequest>>,
];
