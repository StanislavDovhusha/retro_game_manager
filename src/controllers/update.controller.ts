import type { Request, Response } from 'express';
import { checkForUpdates, updateStatus } from '../services/updateService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const updateStatusHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await updateStatus());
});

export const checkUpdatesHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await checkForUpdates());
});
