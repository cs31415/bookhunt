import { Router } from 'express';
import { getBySlug } from '../controllers/authors/get-by-slug';

const router = Router();

/**
 * @swagger
 * /authors/{slug}:
 *   get:
 *     tags: [Authors]
 *     summary: Get an author and their books
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL-safe author identifier
 *     responses:
 *       200:
 *         description: Author with bibliography
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
router.get('/:slug', getBySlug);

export default router;
