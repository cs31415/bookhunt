import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { getLibrary } from '../controllers/library/get-library';
import { addToLibrary } from '../controllers/library/add-to-library';
import { bulkAddToLibrary } from '../controllers/library/bulk-add-to-library';
import { updateEntry } from '../controllers/library/update-entry';
import { removeEntry } from '../controllers/library/remove-entry';
import { addRelated } from '../controllers/library/add-related';
import { removeRelated } from '../controllers/library/remove-related';

const router = Router();

router.use(authRequired);

router.get('/', getLibrary);
router.post('/bulk', bulkAddToLibrary);
router.post('/', addToLibrary);
router.put('/:bookId', updateEntry);
router.delete('/:bookId', removeEntry);
router.post('/:bookId/related', addRelated);
router.delete('/:bookId/related/:relatedBookId', removeRelated);

export default router;
