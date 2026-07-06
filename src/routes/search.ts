import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { searchBooks } from '../controllers/search/search-books';

const router = Router();

router.get('/', authOptional, searchBooks);

export default router;
