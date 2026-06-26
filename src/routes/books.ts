import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { getBySlug } from '../controllers/books/get-by-slug';

const router = Router();

/**
 * @swagger
 * /books/{slug}:
 *   get:
 *     tags: [Books]
 *     summary: Get a book by slug
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL-safe book identifier
 *     responses:
 *       200:
 *         description: Book with optional library status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 book: { type: object }
 *                 inLibrary: { type: boolean }
 *                 libraryEntry: { type: object }
 *       404:
 *         description: Book not found
 */
router.get('/:slug', authOptional, getBySlug);

export default router;
