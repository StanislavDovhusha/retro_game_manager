import { Router } from 'express';
import { checkUpdatesHandler, updateStatusHandler } from '../controllers/update.controller.ts';

const router = Router();

/** A newer version of the application: the start-up status (checks at most once a day), and "Check now". */
router.get('/update', updateStatusHandler);
router.post('/update/check', checkUpdatesHandler);

export default router;
