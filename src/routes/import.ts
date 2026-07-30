import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { resolve } from '../controllers/import/resolve';

const router = Router();

// authRequired before rateLimiter, matching routes/upload.ts: unauthenticated
// callers are rejected without consuming anyone's budget. Auth is needed anyway —
// the endpoint checks the caller's catalog and there is no logged-out use case.
//
// 20/min sits between /upload/scan (5) and /search/metadata (30): each request
// fans out to as many as two provider calls per row, 40 rows at a time.
router.post('/resolve', authRequired, rateLimiter(60_000, 20), resolve);

export default router;
