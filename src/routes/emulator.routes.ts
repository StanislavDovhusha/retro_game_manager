import { Router } from 'express';
import { emulatorStatusHandler, launchGameHandler } from '../controllers/emulator.controller.ts';
import { validate } from '../middlewares/validate.ts';
import { emulatorLaunchInput, emulatorStatusInput } from '../schemas/index.ts';

const router = Router();

/** The emulator of the computer (desktop application only): is it installed, can the game be started; start it. */
router.get('/emulator', validate(emulatorStatusInput), emulatorStatusHandler);
router.post('/emulator/launch', validate(emulatorLaunchInput), launchGameHandler);

export default router;
