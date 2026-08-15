import { Router } from 'express';
import { authOptional, authRequired } from '../middleware/auth';
import { getBySlug } from '../controllers/authors/get-by-slug';
import {
  getFavoriteAuthors,
  addAuthorFavorite,
  removeAuthorFavorite,
} from '../controllers/authors/favorites';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const MINUTE = 60 * 1000;

// The literal above '/:slug', which would otherwise read "favorites" as an
// author slug and 404 on it.
router.get('/favorites', authRequired, rateLimiter(MINUTE, 60), getFavoriteAuthors);
router.get('/:slug', authOptional, getBySlug);
router.post('/:slug/favorite', authRequired, rateLimiter(MINUTE, 30), addAuthorFavorite);
router.delete('/:slug/favorite', authRequired, rateLimiter(MINUTE, 30), removeAuthorFavorite);

export default router;
