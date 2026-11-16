import type { Request, Response } from 'express';
import { dialogFileInput } from '../schemas/index.ts';
import { inputOf } from '../middlewares/validate.ts';
import { pickFile, pickFolder } from '../services/dialogService.ts';
import { getSettings } from '../services/settingsService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const pickFolderHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ path: await pickFolder() });
});

export const pickFileHandler = asyncHandler(async (req: Request, res: Response) => {
  const { kind, multiple } = inputOf(dialogFileInput, req).body;
  const { extensions } = await getSettings();
  if (multiple === true) {
    res.json({ paths: await pickFile(kind, extensions, true) });
    return;
  }
  res.json({ path: await pickFile(kind, extensions) });
});
