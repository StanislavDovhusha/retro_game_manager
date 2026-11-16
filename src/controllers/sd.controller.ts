import type { Request, Response } from 'express';
import { sdPlatformInput, sdRootInput, sdTreeInput } from '../schemas/index.ts';
import { inputOf } from '../middlewares/validate.ts';
import { platformSummaries } from '../services/platformSummaryService.ts';
import { clearPlatform, getSdState, getSdTree, selectPlatform, selectSdRoot, verifySavedSdRoot } from '../services/workspaceService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const setSdRootHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await selectSdRoot(inputOf(sdRootInput, req).body.root));
});

export const getSdStateHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getSdState());
});

export const getSdTreeHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await getSdTree(inputOf(sdTreeInput, req).query.rel ?? ''));
});

export const setPlatformHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await selectPlatform(inputOf(sdPlatformInput, req).body.name));
});

export const verifySdRootHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await verifySavedSdRoot());
});

export const getPlatformsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await platformSummaries());
});

export const clearPlatformHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await clearPlatform());
});
