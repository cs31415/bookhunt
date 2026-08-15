import { Router } from 'express';
import { handleAvailable } from '../controllers/users/handle-available';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const MINUTE = 60 * 1000;

// Unauthenticated and cheap, but it answers a question about who exists, so it
// gets a limit generous enough to type through and tight enough to make
// enumerating the handle space slow. The sign-up form debounces, so a reader
// filling in one handle spends a handful of these.
router.get('/handle-available', rateLimiter(MINUTE, 30), handleAvailable);

export default router;
