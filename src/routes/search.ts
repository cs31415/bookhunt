import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { searchBooks } from '../controllers/search/search-books';
import { getMetadata } from '../controllers/search/get-metadata';

const router = Router();

router.get('/', authOptional, searchBooks);
router.post('/metadata', rateLimiter(60_000, 30), authOptional, getMetadata);

export default router;
