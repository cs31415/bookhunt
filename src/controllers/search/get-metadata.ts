import { Request, Response } from 'express';
import { searchBooks, matchLibraryEntries, SearchResult } from '../../models/ai/search';

interface BookQuery {
  title: string;
  author?: string;
}

/**
 * @swagger
 * /search/metadata:
 *   post:
 *     tags: [Search]
 *     summary: Batch-resolve real metadata (cover, ISBN, rating, etc.) for a list of title/author pairs via Google Books/OpenLibrary
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [books]
 *             properties:
 *               books:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string }
 *                     author: { type: string }
 *     responses:
 *       200:
 *         description: Metadata for each input, in the same order, null where no match was found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     nullable: true
 *       400:
 *         description: Missing or invalid books array
 *       429:
 *         description: Rate limited (30/min)
 */
export async function getMetadata(req: Request, res: Response) {
  try {
    const { books: queries } = req.body;
    if (!Array.isArray(queries) || queries.length === 0) {
      res.status(400).json({ error: 'books array is required' });
      return;
    }

    const batch: BookQuery[] = queries.slice(0, 40);

    const results: (SearchResult | null)[] = [];
    for (const { title, author } of batch) {
      const query = author ? `${title} by ${author}` : title;
      const [match] = await searchBooks(query, 1);
      results.push(match ?? null);
    }

    if (req.user) {
      const resolved = results.filter((b): b is SearchResult => b !== null);
      if (resolved.length > 0) {
        await matchLibraryEntries(req.user.id, resolved);
      }
    }

    res.json({ books: results });
  } catch (error) {
    console.error('Error in search metadata batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
