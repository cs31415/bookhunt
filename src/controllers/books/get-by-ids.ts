import { Request, Response } from 'express';
import { getBooksByIds as getBooksByIdsModel } from '../../models/books/get-by-ids';

const MAX_IDS = 40;

/**
 * @swagger
 * /books:
 *   get:
 *     tags: [Books]
 *     summary: Batch-fetch book summaries by id
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema: { type: string }
 *         description: Comma-separated book ids, e.g. "1,2,3" (max 40)
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
 *         description: Missing or invalid ids parameter
 */
export async function getByIds(req: Request, res: Response) {
  try {
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

    const books = rows.map((row: any) => ({
      id: row.book_id,
      slug: row.slug,
      title: row.title,
      authorName: row.author_name,
      authorSlug: row.author_slug,
      year: row.year,
      rating: row.rating,
      coverUrl: row.cover_url,
      hue: row.hue,
    }));

    res.json({ books });
  } catch (error) {
    console.error('Error fetching books by ids:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
