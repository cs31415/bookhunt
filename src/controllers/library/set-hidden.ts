import { Request, Response } from 'express';
import { setVisibility as setVisibilityModel } from '../../models/library/set-visibility';

/**
 * @swagger
 * /library/{bookId}/hidden:
 *   put:
 *     tags: [Library]
 *     summary: Hide a book from the reader's public profile
 *     description: >
 *       Affects only the public page at bookhunt.net/{handle}. The owner's own
 *       library is unchanged.
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
 *     summary: Show a previously hidden book on the public profile again
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
function handle(isHidden: boolean) {
  return async function setHidden(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const bookId = parseInt(req.params.bookId as string, 10);

      if (Number.isNaN(bookId)) {
        res.status(400).json({ error: 'A numeric book id is required.' });
        return;
      }

      const entry = await setVisibilityModel(userId, bookId, isHidden);

      if (!entry) {
        res.status(404).json({ error: 'Library entry not found' });
        return;
      }

      res.json({ entry });
    } catch (error) {
      console.error('Error setting library visibility:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// PUT hides, DELETE reveals -- the verb carries the state, so there is no body
// to parse and no way for the two to disagree.
export const hideEntry = handle(true);
export const showEntry = handle(false);
