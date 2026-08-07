import { Router } from 'express';
import { authOptional, authRequired } from '../middleware/auth';
import { list } from '../controllers/canned-searches/list';
import { pin, unpin } from '../controllers/canned-searches/pin';
import { save } from '../controllers/canned-searches/save';

const router = Router();

// Optional auth: the Discover pills render for logged-out visitors too, and for
// them this is the only call on the page that must not 401.
router.get('/', authOptional, list);

// Before /:id/pin so "a search the reader typed" cannot be read as an id.
router.post('/', authRequired, save);

router.post('/:id/pin', authRequired, pin);
router.delete('/:id/pin', authRequired, unpin);

export default router;
