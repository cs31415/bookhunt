import { Request, Response } from 'express';
import { setAudiobook as setAudiobookModel } from '../../models/library/set-audiobook';

/**
 * @swagger
 * /library/{bookId}/audiobook:
 *   put:
 *     tags: [Library]
 *     summary: Mark a book as an audiobook
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
 *     summary: Clear the audiobook flag
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
function handle(isAudiobook: boolean) {
  return async function setAudiobook(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const bookId = parseInt(req.params.bookId as string, 10);

      if (Number.isNaN(bookId)) {
        res.status(400).json({ error: 'A numeric book id is required.' });
        return;
      }

      const entry = await setAudiobookModel(userId, bookId, isAudiobook);

      if (!entry) {
        res.status(404).json({ error: 'Library entry not found' });
        return;
      }

      res.json({ entry });
    } catch (error) {
      console.error('Error setting library audiobook flag:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// PUT marks, DELETE clears -- the verb carries the state, so there is no body
// to parse and no way for the two to disagree.
export const markAudiobook = handle(true);
export const clearAudiobook = handle(false);
