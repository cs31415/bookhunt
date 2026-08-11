import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { resolve } from '../controllers/import/resolve';

const router = Router();

// authRequired before rateLimiter: unauthenticated callers are rejected without
// consuming anyone's budget. Auth is needed anyway —
// the endpoint checks the caller's catalog and there is no logged-out use case.
//
// Deliberately high compared with the other routes. The client sends small
// batches so its review list fills in progressively, which means many more
// requests for the same work: a 1000-row import is ~100 calls, and anything
// under that would 429 partway through an import the app itself offered.
//
// The real cost is bounded server-side regardless -- RESOLUTION_CONCURRENCY
// caps provider calls in flight, and Open Library has its own 1 req/sec queue.
router.post('/resolve', authRequired, rateLimiter(60_000, 150), resolve);

export default router;
