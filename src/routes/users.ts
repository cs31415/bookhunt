import { Router } from 'express';
import { handleAvailable } from '../controllers/users/handle-available';
import { updateMe } from '../controllers/users/update-me';
import { getPublicProfile, getPublicLibrary, getPublicLibraryFacetValues } from '../controllers/users/get-public-profile';
import { getPublicLibraryEntry } from '../controllers/users/get-public-library-entry';
import {
  createShareLink,
  deleteShareLink,
  getLibraryByShareToken,
  getProfileByShareToken,
  getShareLink,
  getLibraryFacetsByShareToken,
} from '../controllers/users/share-link';
import { getPublicFavoriteAuthors } from '../controllers/authors/favorites';
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

// The unlisted share link (LOS-305). '/me/...' literals, beside the PUT above.
// authRequired before rateLimiter, as everywhere else in this file.
router.get('/me/share-link', authRequired, rateLimiter(MINUTE, 30), getShareLink);
router.post('/me/share-link', authRequired, rateLimiter(MINUTE, 10), createShareLink);
router.delete('/me/share-link', authRequired, rateLimiter(MINUTE, 10), deleteShareLink);

// Literals, all above '/:handle' for the same reason '/me' is.
router.get('/search', rateLimiter(MINUTE, 60), searchUsers);

// The token is the whole credential, so these are limited harder than the
// handle routes below: guessing a UUID is hopeless, but there is no reason to
// let anyone try at 60 a minute. Unauthenticated by design -- holding the link
// is the authorisation, and a session adds nothing to it.
router.get('/by-token/:token', rateLimiter(MINUTE, 20), getProfileByShareToken);
router.get('/by-token/:token/library', rateLimiter(MINUTE, 20), getLibraryByShareToken);
router.get(
  '/by-token/:token/library/facets',
  rateLimiter(MINUTE, 20),
  getLibraryFacetsByShareToken,
);
router.get('/favorites', authRequired, rateLimiter(MINUTE, 60), getFavorites);

// Last: '/:handle' would otherwise swallow '/handle-available' and '/me'.
// Unauthenticated by design, and rate-limited because it is the one endpoint
// that answers questions about accounts other than the caller's.
router.get('/:handle', rateLimiter(MINUTE, 60), getPublicProfile);
router.get('/:handle/library', rateLimiter(MINUTE, 60), getPublicLibrary);
// Before nothing in particular, but kept beside the shelf it describes.
router.get('/:handle/library/facets', rateLimiter(MINUTE, 60), getPublicLibraryFacetValues);
// After the literal /facets, which would otherwise be read as a bookId and
// parse to NaN -- the same ordering rule as everywhere else in this file.
router.get('/:handle/library/:bookId', rateLimiter(MINUTE, 60), getPublicLibraryEntry);
router.get('/:handle/favorite-authors', rateLimiter(MINUTE, 60), getPublicFavoriteAuthors);
router.post('/:handle/favorite', authRequired, rateLimiter(MINUTE, 30), addFavoriteUser);
router.delete('/:handle/favorite', authRequired, rateLimiter(MINUTE, 30), removeFavoriteUser);

export default router;
