import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { getSummary } from '../controllers/ai/get-summary';
import { regenerateSummary } from '../controllers/ai/regenerate-summary';
import { generateThemes } from '../controllers/ai/generate-themes';
import { generateThemesExternal } from '../controllers/ai/generate-themes-external';
import { categorize } from '../controllers/ai/categorize';
import { search } from '../controllers/ai/search';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/summary/:bookId', getSummary);
router.post('/summary/:bookId', rateLimiter(60_000, 5), regenerateSummary);
router.post('/themes/external', rateLimiter(60_000, 10), generateThemesExternal);
router.post('/themes/:bookId', rateLimiter(60_000, 10), generateThemes);
router.post('/search', rateLimiter(60_000, 10), authOptional, search);
// Low limit because one call can cover 200 books: this is the tail of an
// import, not something a page calls. Auth required — it writes to the catalog.
router.post('/categorize', authRequired, rateLimiter(60_000, 5), categorize);

export default router;
