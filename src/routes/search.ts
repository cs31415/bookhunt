import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { searchBooks } from '../controllers/search/search-books';

const router = Router();

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Search the catalog by text and/or facets
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free text query
 *       - in: query
 *         name: subjects
 *         schema: { type: array, items: { type: string } }
 *         style: form
 *         explode: true
 *         description: Filter by subject (repeatable)
 *       - in: query
 *         name: moods
 *         schema: { type: array, items: { type: string } }
 *         style: form
 *         explode: true
 *         description: Filter by mood (repeatable)
 *       - in: query
 *         name: decade
 *         schema: { type: integer }
 *         description: Filter by decade, e.g. 1990
 *       - in: query
 *         name: authorSlug
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [queued, reading, finished, abandoned] }
 *         description: Filter by the caller's library status (requires auth; ignored otherwise)
 *       - in: query
 *         name: inLibraryOnly
 *         schema: { type: boolean }
 *         description: Only return books in the caller's library (requires auth; ignored otherwise)
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [relevance, rating, newest, oldest, title] }
 *         description: Defaults to relevance when q is present, otherwise newest
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 24, maximum: 60 }
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 books: { type: array, items: { type: object } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *                 query: { type: string }
 */
router.get('/', authOptional, searchBooks);

export default router;
