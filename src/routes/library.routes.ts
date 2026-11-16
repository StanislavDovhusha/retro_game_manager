import { Router } from 'express';
import { getLibraryHandler, getLogHandler, getStatusHandler } from '../controllers/library.controller.ts';

const router = Router();

router.get('/library', getLibraryHandler);
router.get('/status', getStatusHandler);
router.get('/log', getLogHandler);

export default router;
