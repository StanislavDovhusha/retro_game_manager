import type { Request, Response } from 'express';
import { buildSearchIndex } from '../services/searchService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const getSearchIndexHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await buildSearchIndex());
});
