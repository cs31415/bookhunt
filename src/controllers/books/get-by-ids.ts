import { Request, Response } from 'express';
import { getBooksByIds as getBooksByIdsModel } from '../../models/books/get-by-ids';
import { getBooksByGoogleIds as getBooksByGoogleIdsModel } from '../../models/books/get-by-google-ids';

const MAX_IDS = 40;

/**
 * @swagger
 * /books:
 *   get:
 *     tags: [Books]
 *     summary: Batch-fetch book summaries by id, or by googleBooksId
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: false
 *         schema: { type: string }
 *         description: Comma-separated book ids, e.g. "1,2,3" (max 40). Mutually exclusive with googleBooksIds.
 *       - in: query
 *         name: googleBooksIds
 *         required: false
 *         schema: { type: string }
 *         description: Comma-separated Google Books volume ids (max 40), for resolving a search result to its catalog slug. Mutually exclusive with ids.
 *     responses:
 *       200:
 *         description: Book summaries, in the order requested; unmatched ids are omitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 books: { type: array, items: { type: object } }
 *       400:
 *         description: Missing or invalid ids/googleBooksIds parameter
 */
export async function getByIds(req: Request, res: Response) {
  try {
    if (typeof req.query.googleBooksIds === 'string') {
      const googleBooksIds = [
        ...new Set(
          req.query.googleBooksIds
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ].slice(0, MAX_IDS);

      if (googleBooksIds.length === 0) {
        res.status(400).json({ error: 'googleBooksIds query parameter is required' });
        return;
      }

      const rows = await getBooksByGoogleIdsModel(googleBooksIds);
      res.json({ books: rows.map(formatRow) });
      return;
    }

    const raw = typeof req.query.ids === 'string' ? req.query.ids : '';
    const ids = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => parseInt(v, 10))
      .filter((n) => Number.isFinite(n));

    if (ids.length === 0) {
      res.status(400).json({ error: 'ids query parameter is required' });
      return;
    }

    const capped = [...new Set(ids)].slice(0, MAX_IDS);
    const rows = await getBooksByIdsModel(capped);

    res.json({ books: rows.map(formatRow) });
  } catch (error) {
    console.error('Error fetching books by ids:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function formatRow(row: any) {
  return {
    id: row.book_id,
    slug: row.slug,
    title: row.title,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    year: row.year,
    rating: row.rating,
    coverUrl: row.cover_url,
    hue: row.hue,
    ...(row.google_books_id !== undefined ? { googleBooksId: row.google_books_id } : {}),
  };
}
