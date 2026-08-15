import { Router } from 'express';
import { handleAvailable } from '../controllers/users/handle-available';
import { updateMe } from '../controllers/users/update-me';
import { getPublicProfile, getPublicLibrary } from '../controllers/users/get-public-profile';
import {
  searchUsers,
  getFavorites,
  addFavoriteUser,
  removeFavoriteUser,
} from '../controllers/users/favorites';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const MINUTE = 60 * 1000;

// Unauthenticated and cheap, but it answers a question about who exists, so it
// gets a limit generous enough to type through and tight enough to make
// enumerating the handle space slow. The sign-up form debounces, so a reader
// filling in one handle spends a handful of these.
router.get('/handle-available', rateLimiter(MINUTE, 30), handleAvailable);

// authRequired before rateLimiter, so an unauthenticated caller cannot spend
// the budget -- the ordering convention documented in routes/import.ts.
// '/me' is a literal and stays above any future '/:handle'.
router.put('/me', authRequired, rateLimiter(MINUTE, 20), updateMe);

// Literals, all above '/:handle' for the same reason '/me' is.
router.get('/search', rateLimiter(MINUTE, 60), searchUsers);
router.get('/favorites', authRequired, rateLimiter(MINUTE, 60), getFavorites);

// Last: '/:handle' would otherwise swallow '/handle-available' and '/me'.
// Unauthenticated by design, and rate-limited because it is the one endpoint
// that answers questions about accounts other than the caller's.
router.get('/:handle', rateLimiter(MINUTE, 60), getPublicProfile);
router.get('/:handle/library', rateLimiter(MINUTE, 60), getPublicLibrary);
router.post('/:handle/favorite', authRequired, rateLimiter(MINUTE, 30), addFavoriteUser);
router.delete('/:handle/favorite', authRequired, rateLimiter(MINUTE, 30), removeFavoriteUser);

export default router;
