import type { Request, Response } from 'express';
import { getJournal } from '../services/journalService.ts';
import { scanLibrary } from '../services/libraryService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { currentOperation } from '../utils/lock.ts';

export const getLibraryHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await scanLibrary());
});

export const getStatusHandler = (_req: Request, res: Response): void => {
  res.json({ busy: currentOperation() });
};

export const getLogHandler = (_req: Request, res: Response): void => {
  res.json({ entries: getJournal() });
};
