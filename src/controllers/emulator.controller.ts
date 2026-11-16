import type { Request, Response } from 'express';
import { inputOf } from '../middlewares/validate.ts';
import { emulatorLaunchInput, emulatorStatusInput } from '../schemas/index.ts';
import { emulatorStatus, launchGame } from '../services/emulatorService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const emulatorStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await emulatorStatus(inputOf(emulatorStatusInput, req).query.rel));
});

export const launchGameHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await launchGame(inputOf(emulatorLaunchInput, req).body.rel));
});
