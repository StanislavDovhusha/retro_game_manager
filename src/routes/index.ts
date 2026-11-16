import { Router } from 'express';
import addRoutes from './add.routes.ts';
import csvRoutes from './csv.routes.ts';
import deviceRoutes from './device.routes.ts';
import emulatorRoutes from './emulator.routes.ts';
import gamesRoutes from './games.routes.ts';
import libraryRoutes from './library.routes.ts';
import sdRoutes from './sd.routes.ts';
import searchRoutes from './search.routes.ts';
import settingsRoutes from './settings.routes.ts';
import syncRoutes from './sync.routes.ts';
import updateRoutes from './update.routes.ts';

/** All `/api` routes. The files only wire a path to a validation schema and a controller: no logic lives here. */
const router = Router();

router.use(settingsRoutes);
router.use(deviceRoutes);
router.use(sdRoutes);
router.use(libraryRoutes);
router.use(gamesRoutes);
router.use(csvRoutes);
router.use(addRoutes);
router.use(syncRoutes);
router.use(searchRoutes);
router.use(emulatorRoutes);
router.use(updateRoutes);

export default router;
