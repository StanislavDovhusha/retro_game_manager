import { Router } from 'express';
import { devicesHandler } from '../controllers/device.controller.ts';

const router = Router();

/** The console models (profiles of `devices/`) and the profile of the chosen one. */
router.get('/devices', devicesHandler);

export default router;
