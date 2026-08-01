import { Request, Response } from 'express';
import { searchLibrary as searchLibraryModel } from '../../models/library/search-library';

/**
 * @swagger
 * /library/search:
 *   get:
 *     tags: [Library]
 *     summary: Keyword search over the authenticated user's own library
 *     description: >
 *       Postgres-only free-text search across the caller's shelf — no LLM, so it
 *       answers in milliseconds. Scoring matches /search (title, author, subjects,
 *       genres, themes, moods, plus a whole-phrase bonus), and entries come back in
 *       the same shape as GET /library.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free text. Omit to browse the whole library.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [queued, reading, finished, abandoned] }
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [relevance, added, rating, newest, oldest, title]
 *           default: relevance
 *         description: Defaults to `relevance` with a query, `added` without one.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 24, maximum: 60 }
 *     responses:
 *       200:
 *         description: Matching library entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Same shape as GET /library, plus a `relevance` score.
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *                 query: { type: string }
 *       401:
 *         description: Authentication required
 */
export async function searchLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const result = await searchLibraryModel(userId, req.query);
    res.json(result);
  } catch (error) {
    console.error('Error searching library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
