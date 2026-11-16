import { Router } from 'express';
import { getSearchIndexHandler } from '../controllers/search.controller.ts';

const router = Router();

/** The games of every platform folder of the card, for the search field in the header. */
router.get('/search/index', getSearchIndexHandler);

export default router;
