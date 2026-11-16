import { Router } from 'express';
import {
  addGameHandler,
  addProgressHandler,
  discardUploadHandler,
  inspectHandler,
  inspectSetHandler,
  uploadHandler,
} from '../controllers/add.controller.ts';
import { validate } from '../middlewares/validate.ts';
import { addGameInput, discardUploadInput, inspectInput, inspectSetInput, uploadInput } from '../schemas/index.ts';

const router = Router();

router.post('/add/inspect', validate(inspectInput), inspectHandler);
router.post('/add/inspect-set', validate(inspectSetInput), inspectSetHandler);
router.post('/games/add', validate(addGameInput), addGameHandler);
router.get('/add/progress', addProgressHandler);

router.put('/upload', validate(uploadInput), uploadHandler);
router.delete('/upload/:id', validate(discardUploadInput), discardUploadHandler);

export default router;
