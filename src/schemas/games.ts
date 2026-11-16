import { z } from 'zod';
import { t } from '../i18n/index.ts';
import { defineInput } from '../middlewares/validate.ts';
import type {
  DeleteGameRequest,
  DeleteGamesRequest,
  DeleteImageRequest,
  RenameGameRequest,
  RenamePreviewRequest,
  SetImageRequest,
  UpdateEntryRequest,
} from '../models/index.ts';
import { confirmed, diskPath, gameTitle, relPath } from './common.ts';
import type { Accepts, Assert } from './common.ts';

const MAX_DELETE_BATCH = 100_000;
const deletionConfirmed = confirmed(() => t('Deletion requires confirmation'));

const deleteGameBody = z.object({
  rel: relPath,
  removeFromCsv: z.boolean().default(true),
  confirmed: deletionConfirmed,
});
const deleteGamesBody = z.object({
  rels: z
    .array(relPath)
    .max(MAX_DELETE_BATCH)
    .refine((list) => list.length > 0, { error: () => t('No games selected for deletion') }),
  removeFromCsv: z.boolean().default(true),
  confirmed: deletionConfirmed,
});
const renamePreviewBody = z.object({ rel: relPath, title: gameTitle });
const renameBody = z.object({ rel: relPath, title: gameTitle, confirmed: confirmed(() => t('Renaming requires confirmation')) });
const updateEntryBody = z
  .object({
    rel: relPath,
    name: gameTitle.optional(),
    short: z.string().max(512).optional(),
    tags: z.array(z.string().max(512)).max(500).optional(),
    confirmed: z.boolean().optional(),
  })
  .refine((body) => body.name !== undefined || body.short !== undefined || body.tags !== undefined, {
    error: () => t('Nothing to change'),
  });
const imageQuery = z.object({ rel: relPath });
const setImageBody = z.object({ rel: relPath, imagePath: diskPath });
const deleteImageBody = z.object({ rel: relPath, confirmed: deletionConfirmed });

export const deleteGameInput = defineInput({ body: deleteGameBody });
export const deleteGamesInput = defineInput({ body: deleteGamesBody });
export const renamePreviewInput = defineInput({ body: renamePreviewBody });
export const renameInput = defineInput({ body: renameBody });
export const updateEntryInput = defineInput({ body: updateEntryBody });
export const getImageInput = defineInput({ query: imageQuery });
export const setImageInput = defineInput({ body: setImageBody });
export const deleteImageInput = defineInput({ body: deleteImageBody });

export type _GameChecks = [
  Assert<Accepts<typeof deleteGameBody, DeleteGameRequest>>,
  Assert<Accepts<typeof deleteGamesBody, DeleteGamesRequest>>,
  Assert<Accepts<typeof renamePreviewBody, RenamePreviewRequest>>,
  Assert<Accepts<typeof renameBody, RenameGameRequest>>,
  Assert<Accepts<typeof updateEntryBody, UpdateEntryRequest>>,
  Assert<Accepts<typeof setImageBody, SetImageRequest>>,
  Assert<Accepts<typeof deleteImageBody, DeleteImageRequest>>,
];
