import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { getBySlug } from '../controllers/books/get-by-slug';
import { getByIds } from '../controllers/books/get-by-ids';

const router = Router();

router.get('/', authOptional, getByIds);
router.get('/:slug', authOptional, getBySlug);

export default router;
