import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { applySync, previewSync } from '../services/syncService.ts';

export const previewSyncHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await previewSync());
});

/** The confirmation flag is checked by the request schema; here the sync is simply run. */
export const applySyncHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await applySync());
});
