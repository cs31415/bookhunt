import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { getLibrary } from '../controllers/library/get-library';
import { searchLibrary } from '../controllers/library/search-library';
import { addToLibraryBySlug } from '../controllers/library/add-to-library-by-slug';
import { bulkAddToLibrary } from '../controllers/library/bulk-add-to-library';
import { updateEntry } from '../controllers/library/update-entry';
import { removeEntry } from '../controllers/library/remove-entry';
import { bulkRemoveFromLibrary } from '../controllers/library/bulk-remove-from-library';
import { addRelated } from '../controllers/library/add-related';
import { removeRelated } from '../controllers/library/remove-related';

const router = Router();

router.use(authRequired);

router.get('/', getLibrary);
// Above the /:slug routes: a literal path has to be matched before the wildcard
// that would otherwise swallow it.
router.get('/search', searchLibrary);
router.post('/bulk', bulkAddToLibrary);
router.post('/:slug', addToLibraryBySlug);
router.put('/:bookId', updateEntry);
// Above the wildcard for the same reason /search is: otherwise "bulk" is read
// as a bookId and parses to NaN.
router.delete('/bulk', bulkRemoveFromLibrary);
router.delete('/:bookId', removeEntry);
router.post('/:bookId/related', addRelated);
router.delete('/:bookId/related/:relatedBookId', removeRelated);

export default router;
