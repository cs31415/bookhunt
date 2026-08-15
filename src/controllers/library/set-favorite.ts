import { Request, Response } from 'express';
import { setFavorite as setFavoriteModel } from '../../models/library/set-favorite';

/**
 * @swagger
 * /library/{bookId}/favorite:
 *   put:
 *     tags: [Library]
 *     summary: Mark a book as a favourite
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The updated flags
 *       404:
 *         description: Entry not found
 *   delete:
 *     tags: [Library]
 *     summary: Remove a book from favourites
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The updated flags
 *       404:
 *         description: Entry not found
 */
function handle(isFavorite: boolean) {
  return async function setFavorite(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const bookId = parseInt(req.params.bookId as string, 10);

      if (Number.isNaN(bookId)) {
        res.status(400).json({ error: 'A numeric book id is required.' });
        return;
      }

      const entry = await setFavoriteModel(userId, bookId, isFavorite);

      if (!entry) {
        res.status(404).json({ error: 'Library entry not found' });
        return;
      }

      res.json({ entry });
    } catch (error) {
      console.error('Error setting library favorite:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Two verbs rather than a body: the state is in the method, so there is nothing
// to parse and nothing to disagree about. PUT sets, DELETE clears.
export const addFavorite = handle(true);
export const removeFavorite = handle(false);
