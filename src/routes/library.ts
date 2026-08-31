import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { getLibrary } from '../controllers/library/get-library';
import { searchLibrary } from '../controllers/library/search-library';
import { exportLibrary } from '../controllers/library/export-library';
import { addToLibraryBySlug } from '../controllers/library/add-to-library-by-slug';
import { bulkAddToLibrary } from '../controllers/library/bulk-add-to-library';
import { updateEntry } from '../controllers/library/update-entry';
import { removeEntry } from '../controllers/library/remove-entry';
import { bulkRemoveFromLibrary } from '../controllers/library/bulk-remove-from-library';
import { addRelated } from '../controllers/library/add-related';
import { removeRelated } from '../controllers/library/remove-related';
import { addFavorite, removeFavorite } from '../controllers/library/set-favorite';
import { setReviewSharing } from '../controllers/library/set-review-sharing';
import { hideEntry, showEntry } from '../controllers/library/set-hidden';
import { markEbook, markPhysical } from '../controllers/library/set-ebook';
import { markAudiobook, clearAudiobook } from '../controllers/library/set-audiobook';

const router = Router();

router.use(authRequired);

router.get('/', getLibrary);
// Above the /:slug routes: a literal path has to be matched before the wildcard
// that would otherwise swallow it.
router.get('/search', searchLibrary);
// A literal, above /:slug for the same reason /search is. The only rate limit
// in this router: every other route touches one entry, while this one reads the
// whole library and is worth nothing to call twice in a row.
router.get('/export', rateLimiter(60 * 60 * 1000, 10), exportLibrary);
router.post('/bulk', bulkAddToLibrary);
router.post('/:slug', addToLibraryBySlug);
// Before the bare /:bookId, so "favorite" and "hidden" are read as the literal
// sub-paths they are rather than as part of a book id.
router.put('/:bookId/favorite', addFavorite);
router.delete('/:bookId/favorite', removeFavorite);
// Three states, so a body rather than two verbs (LOS-266).
router.put('/:bookId/review-sharing', setReviewSharing);
router.put('/:bookId/hidden', hideEntry);
router.delete('/:bookId/hidden', showEntry);
router.put('/:bookId/ebook', markEbook);
router.delete('/:bookId/ebook', markPhysical);
router.put('/:bookId/audiobook', markAudiobook);
router.delete('/:bookId/audiobook', clearAudiobook);
router.put('/:bookId', updateEntry);
// Above the wildcard for the same reason /search is: otherwise "bulk" is read
// as a bookId and parses to NaN.
router.delete('/bulk', bulkRemoveFromLibrary);
router.delete('/:bookId', removeEntry);
router.post('/:bookId/related', addRelated);
router.delete('/:bookId/related/:relatedBookId', removeRelated);

export default router;
