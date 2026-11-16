import { Router } from 'express';
import {
  applyMissingHandler,
  getCsvDataHandler,
  previewCsvHandler,
  previewMissingHandler,
  saveCsvDataHandler,
} from '../controllers/csv.controller.ts';
import { validate } from '../middlewares/validate.ts';
import { csvPreviewInput, csvSaveInput, missingApplyInput } from '../schemas/index.ts';

const router = Router();

router.get('/csv/data', getCsvDataHandler);
router.put('/csv/data', validate(csvSaveInput), saveCsvDataHandler);
router.post('/csv/preview', validate(csvPreviewInput), previewCsvHandler);
router.post('/csv/missing/preview', previewMissingHandler);
router.post('/csv/missing/apply', validate(missingApplyInput), applyMissingHandler);

export default router;
