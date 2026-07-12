import { Request, Response } from 'express';
import { searchBooks, matchLibraryEntries } from '../../models/ai/search';
import { searchBooksWithClaude } from '../../models/ai/search-claude';

/**
 * @swagger
 * /ai/search:
 *   post:
 *     tags: [AI]
 *     summary: Search via LLM with library matching, falling back to the books API
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string }
 *               inLibraryOnly: { type: boolean, default: false }
 *               limit: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results with library flags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       googleBooksId: { type: string }
 *                       title: { type: string }
 *                       authors: { type: array, items: { type: string } }
 *                       year: { type: integer, nullable: true }
 *                       publisher: { type: string }
 *                       pages: { type: integer }
 *                       rating: { type: number }
 *                       coverUrl: { type: string }
 *                       isbn13: { type: string, nullable: true }
 *                       language: { type: string }
 *                       blurb: { type: string }
 *                       categories: { type: array, items: { type: string } }
 *                       moods: { type: array, items: { type: string } }
 *                       inLibrary: { type: boolean }
 *                       libraryStatus: { type: string, nullable: true }
 *                 query: { type: string }
 *       400:
 *         description: Missing query
 *       429:
 *         description: Rate limited (10/min)
 */
export async function search(req: Request, res: Response) {
  try {
    const { query, inLibraryOnly = false, limit = 20 } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }

    let books = await searchBooksWithClaude(query, limit);
    if (books.length === 0) {
      books = await searchBooks(query, limit);
    }

    if (req.user && books.length > 0) {
      await matchLibraryEntries(req.user.id, books);
    }

    let results = books;
    if (inLibraryOnly) {
      results = books.filter((b) => b.inLibrary);
    } else {
      results = [
        ...books.filter((b) => b.inLibrary),
        ...books.filter((b) => !b.inLibrary),
      ];
    }

    res.json({ books: results, query });
  } catch (error) {
    console.error('Error in AI search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
