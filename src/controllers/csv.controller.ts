import type { Request, Response } from 'express';
import { inputOf } from '../middlewares/validate.ts';
import { csvPreviewInput, csvSaveInput, missingApplyInput } from '../schemas/index.ts';
import { getCsvData, previewCsv, previewMissing, removeMissing, saveCsvData } from '../services/csvService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const getCsvDataHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getCsvData());
});

export const saveCsvDataHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await saveCsvData({ rows: inputOf(csvSaveInput, req).body.rows }));
});

export const previewCsvHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await previewCsv(inputOf(csvPreviewInput, req).body));
});

export const previewMissingHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await previewMissing());
});

export const applyMissingHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await removeMissing({ expected: inputOf(missingApplyInput, req).body.expected }));
});
