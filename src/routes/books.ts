import { Router } from 'express';
import { authOptional, authRequired } from '../middleware/auth';
import { getBySlug } from '../controllers/books/get-by-slug';
import { getByIds } from '../controllers/books/get-by-ids';
import { resolveOrCreate } from '../controllers/books/resolve-or-create';

const router = Router();

router.get('/', authOptional, getByIds);
router.post('/', authRequired, resolveOrCreate);
router.get('/:slug', authOptional, getBySlug);

export default router;
