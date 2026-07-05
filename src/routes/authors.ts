import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { getBySlug } from '../controllers/authors/get-by-slug';

const router = Router();

/**
 * @swagger
 * /authors/{slug}:
 *   get:
 *     tags: [Authors]
 *     summary: Get an author and their full bibliography
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL-safe author identifier
 *     responses:
 *       200:
 *         description: Author with bibliography, each book flagged with in-library status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 author: { type: object }
 *                 books:
 *                   type: array
 *                   items: { type: object }
 *       404:
 *         description: Author not found
 */
router.get('/:slug', authOptional, getBySlug);

export default router;
