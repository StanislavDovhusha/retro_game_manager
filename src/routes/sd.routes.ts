import { Router } from 'express';
import {
  clearPlatformHandler,
  getPlatformsHandler,
  getSdStateHandler,
  getSdTreeHandler,
  setPlatformHandler,
  setSdRootHandler,
  verifySdRootHandler,
} from '../controllers/sd.controller.ts';
import { validate } from '../middlewares/validate.ts';
import { sdPlatformInput, sdRootInput, sdTreeInput } from '../schemas/index.ts';

const router = Router();

router.get('/sd', getSdStateHandler);
router.put('/sd/root', validate(sdRootInput), setSdRootHandler);
/** On start: is the saved card still there? If not, its selection is reset. */
router.post('/sd/verify', verifySdRootHandler);
router.get('/sd/tree', validate(sdTreeInput), getSdTreeHandler);
router.put('/sd/platform', validate(sdPlatformInput), setPlatformHandler);
/** The platform list of the main screen (with game counts), and going back to it. */
router.get('/sd/platforms', getPlatformsHandler);
router.delete('/sd/platform', clearPlatformHandler);

export default router;
