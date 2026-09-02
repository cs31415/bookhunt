import { Request, Response } from 'express';
import { searchBooks as searchBooksModel } from '../../models/search/search-books';
import { AllProvidersFailedError } from '../../lib/books/all-providers-failed-error';

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
export async function searchBooks(req: Request, res: Response) {
  try {
    const userId = req.user?.id ?? null;
    const result = await searchBooksModel(req.query, userId);
    res.json(result);
  } catch (error) {
    /*
     * The catalogue was never reached, as distinct from reaching it and finding
     * nothing (LOS-318). Answering 200 with an empty list here would tell a
     * reader their book does not exist, when what happened is that we could not
     * look. 503 says come back, and names the retry.
     */
    if (error instanceof AllProvidersFailedError) {
      console.error('Book search: every provider failed:', error.providers, error);
      res.status(503).json({
        error: error.rateLimited
          ? 'Book search is busy right now. Please try again in a minute.'
          : 'Book search is unavailable right now. Please try again shortly.',
        code: 'SEARCH_UNAVAILABLE',
      });
      return;
    }
    console.error('Error searching books:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
