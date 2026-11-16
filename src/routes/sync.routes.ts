import { Router } from 'express';
import { applySyncHandler, previewSyncHandler } from '../controllers/sync.controller.ts';
import { validate } from '../middlewares/validate.ts';
import { syncApplyInput } from '../schemas/index.ts';

const router = Router();

router.post('/sync/preview', previewSyncHandler);
router.post('/sync/apply', validate(syncApplyInput), applySyncHandler);

export default router;
