import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { getBySlug } from '../controllers/books/get-by-slug';
import { getByIds } from '../controllers/books/get-by-ids';

const router = Router();

router.get('/', authOptional, getByIds);
// Limited despite being a read, because a catalog miss is not one: it runs a
// live provider search and persists what comes back (LOS-151). Unlimited and
// unauthenticated, that let anyone spend provider calls and write rows to the
// shared catalog by inventing slugs (LOS-222).
//
// Twenty a minute is far above a reader browsing book pages, which costs one
// request per page view, and caps enumeration at twenty provider calls a
// minute. Keyed on the caller rather than the BFF once TRUSTED_PROXY_HOPS is
// set (LOS-221).
router.get('/:slug', rateLimiter(60_000, 20), authOptional, getBySlug);

export default router;
