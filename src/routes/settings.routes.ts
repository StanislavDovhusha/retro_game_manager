import { Router } from 'express';
import { pickFileHandler, pickFolderHandler } from '../controllers/dialog.controller.ts';
import { getSettingsHandler, openBackupsHandler, updateSettingsHandler } from '../controllers/settings.controller.ts';
import { validate } from '../middlewares/validate.ts';
import { dialogFileInput, updateSettingsInput } from '../schemas/index.ts';

const router = Router();

router.get('/settings', getSettingsHandler);
router.put('/settings', validate(updateSettingsInput), updateSettingsHandler);

router.post('/backups/open', openBackupsHandler);

router.post('/dialog/folder', pickFolderHandler);
router.post('/dialog/file', validate(dialogFileInput), pickFileHandler);

export default router;
