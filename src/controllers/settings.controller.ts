import type { Request, Response } from 'express';
import { ENCODINGS } from '../../shared/constants.ts';
import type { SettingsPatch } from '../models/index.ts';
import { updateSettingsInput } from '../schemas/index.ts';
import { inputOf } from '../middlewares/validate.ts';
import { openBackupsFolder } from '../services/backupService.ts';
import { getSettings, toPublicSettings } from '../services/settingsService.ts';
import { saveSettings } from '../services/workspaceService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ settings: toPublicSettings(await getSettings()), encodings: ENCODINGS });
});

export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const patch: SettingsPatch = inputOf(updateSettingsInput, req).body;
  res.json({ settings: await saveSettings(patch) });
});

/** Opens the backup folder of the current card in the file manager of the computer the server runs on. */
export const openBackupsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await openBackupsFolder());
});
