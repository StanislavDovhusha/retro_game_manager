import type { Request, Response } from 'express';
import { devicesResponse } from '../services/deviceService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const devicesHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await devicesResponse());
});
