import { Router } from 'express';
import {
  deleteGameHandler,
  deleteGamesHandler,
  deleteImageHandler,
  getImageHandler,
  previewRenameHandler,
  renameGameHandler,
  setImageHandler,
  updateEntryHandler,
} from '../controllers/games.controller.ts';
import { validate } from '../middlewares/validate.ts';
import {
  deleteGameInput,
  deleteGamesInput,
  deleteImageInput,
  getImageInput,
  renameInput,
  renamePreviewInput,
  setImageInput,
  updateEntryInput,
} from '../schemas/index.ts';

const router = Router();

router.delete('/games', validate(deleteGameInput), deleteGameHandler);
router.delete('/games/batch', validate(deleteGamesInput), deleteGamesHandler);

router.post('/games/rename/preview', validate(renamePreviewInput), previewRenameHandler);
router.post('/games/rename', validate(renameInput), renameGameHandler);

router.put('/games/entry', validate(updateEntryInput), updateEntryHandler);

router.get('/games/image', validate(getImageInput), getImageHandler);
router.put('/games/image', validate(setImageInput), setImageHandler);
router.delete('/games/image', validate(deleteImageInput), deleteImageHandler);

export default router;
