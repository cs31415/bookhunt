import { Request, Response } from 'express';
import { categorizeBookIds } from '../../models/ai/categorize-book-ids';

/**
 * @swagger
 * /ai/categorize:
 *   post:
 *     tags: [AI]
 *     summary: Categorize books by id, in batches, skipping any already tagged
 *     description: Called once at the end of an import. The import adds books one request at a time and concurrently, so there is no point at which the server sees them together - and a model shown one book describes that book, while only a batch lets it group them.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookIds]
 *             properties:
 *               bookIds: { type: array, items: { type: integer } }
 *     responses:
 *       200:
 *         description: The books that were tagged
 *       400:
 *         description: bookIds missing or not an array of numbers
 *       429:
 *         description: Rate limited
 */
export async function categorize(req: Request, res: Response) {
  try {
    const { bookIds } = req.body ?? {};
    if (!Array.isArray(bookIds) || bookIds.some((id) => !Number.isInteger(id))) {
      res.status(400).json({ error: 'bookIds must be an array of integers' });
      return;
    }

    const categorized = await categorizeBookIds(bookIds);
    res.json({ categorized: categorized.length });
  } catch (error) {
    // The books are already in the library; failing to tag them is not worth an
    // error the caller has to handle, and the backfill picks them up later.
    console.error('Error categorizing books:', error);
    res.status(200).json({ categorized: 0 });
  }
}
