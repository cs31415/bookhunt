import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { getBySlug } from '../controllers/authors/get-by-slug';

const router = Router();

router.get('/:slug', authOptional, getBySlug);

export default router;
