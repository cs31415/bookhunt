import { Request, Response } from 'express';
import { bulkRemoveFromLibrary as bulkRemoveFromLibraryModel } from '../../models/library/bulk-remove-from-library';

/** Matches the bulk-add cap: the client sends the review list in batches of this size. */
const MAX_BOOKS = 20;

/**
 * @swagger
 * /library/bulk:
 *   delete:
 *     tags: [Library]
 *     summary: Remove several books from the library at once
 *     description: |
 *       Takes `{ bookIds: [1, 2, 3] }` (1–20) and removes each from the caller's library.
 *
 *       Only the library entry goes. The books stay in the catalog — they are shared, and
 *       another reader may own the same ones — so this is not a way to delete a book.
 *
 *       What it does destroy is the entry: status, rating and review go with it, and
 *       there is no undo. It also prunes the removed books from the `user_related` lists of
 *       the caller's surviving entries, so nothing goes on pointing at a book they no longer
 *       have.
 *
 *       `removed` can be lower than the number of ids sent. An id the caller does not own
 *       matches nothing, which is reported rather than treated as an error: what they asked
 *       for — those books not being in their library — holds either way.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookIds]
 *             properties:
 *               bookIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 20
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: Entries removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed: { type: integer, description: How many entries were actually deleted }
 *                 requested: { type: integer, description: How many distinct ids were asked for }
 *       400:
 *         description: bookIds missing, empty, over 20 items, or holding a non-integer
 *       401:
 *         description: Authentication required
 */
export async function bulkRemoveFromLibrary(req: Request, res: Response) {
  const { bookIds } = req.body;

  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    res.status(400).json({ error: 'bookIds must be a non-empty array' });
    return;
  }

  if (bookIds.length > MAX_BOOKS) {
    res.status(400).json({ error: `bookIds must contain at most ${MAX_BOOKS} items` });
    return;
  }

  // Checked rather than coerced: a stray string here would reach the query as a
  // book id of NaN, and a delete is not the place to guess what was meant.
  if (!bookIds.every((id: unknown) => Number.isInteger(id))) {
    res.status(400).json({ error: 'bookIds must contain only integers' });
    return;
  }

  try {
    const userId = req.user!.id;
    const { removed, requested } = await bulkRemoveFromLibraryModel(userId, bookIds);
    res.json({ removed, requested });
  } catch (error) {
    console.error('Error removing books from library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
