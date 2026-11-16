import type { Request, Response } from 'express';
import { inputOf } from '../middlewares/validate.ts';
import { addGameInput, discardUploadInput, inspectInput, inspectSetInput, uploadInput } from '../schemas/index.ts';
import { addGame, describePlan, inspectSource, planGame, receiveUpload } from '../services/addGameService.ts';
import { getAddProgress } from '../services/addProgress.ts';
import { getSettings } from '../services/settingsService.ts';
import { discardStaged } from '../services/uploadService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const inspectHandler = asyncHandler(async (req: Request, res: Response) => {
  const { kind, path } = inputOf(inspectInput, req).body;
  const { fileName, ext, size } = await inspectSource({ type: 'path', path }, kind, await getSettings());
  res.json({ fileName, ext, size });
});

/** Checks a set of game files (one file, .cue + .bin, CloneCD, ECM) before adding: what will result and which warnings apply. */
export const inspectSetHandler = asyncHandler(async (req: Request, res: Response) => {
  const { paths } = inputOf(inspectSetInput, req).body;
  const plan = await planGame(
    paths.map((path) => ({ type: 'path' as const, path })),
    await getSettings(),
  );
  res.json(describePlan(plan));
});

export const uploadHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query, headers } = inputOf(uploadInput, req);
  res.json(await receiveUpload(req, { kind: query.kind, fileNameHeader: headers['x-file-name'] }));
});

export const discardUploadHandler = asyncHandler(async (req: Request, res: Response) => {
  await discardStaged(inputOf(discardUploadInput, req).params.id);
  res.json({ ok: true });
});

export const addGameHandler = asyncHandler(async (req: Request, res: Response) => {
  const { game, title, image, compress } = inputOf(addGameInput, req).body;
  res.json(await addGame({ game, title, image, compress }));
});

/** What the server is doing with the game being added (unpacking ECM, building the .img) and how far it got. */
export const addProgressHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(getAddProgress());
});
