import { Router } from 'express';
import {
  listConversations,
  getConversation,
  getUnreadCount,
  markConversationRead,
  postMessage,
} from '../controllers/messages/messages';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const MINUTE = 60 * 1000;

// authRequired before rateLimiter throughout, so an unauthenticated caller
// cannot spend the budget -- the ordering convention documented in
// routes/import.ts.
router.use(authRequired);

router.get('/', rateLimiter(MINUTE, 60), listConversations);
// Literal, above '/:handle'.
router.get('/unread-count', rateLimiter(MINUTE, 120), getUnreadCount);
router.get('/:handle', rateLimiter(MINUTE, 60), getConversation);
// Tighter than the reads: this is the one that writes, and the only one worth
// flooding.
router.post('/:handle', rateLimiter(MINUTE, 30), postMessage);
router.post('/:handle/read', rateLimiter(MINUTE, 60), markConversationRead);

export default router;
