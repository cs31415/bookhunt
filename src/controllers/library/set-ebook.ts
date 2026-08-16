import { Request, Response } from 'express';
import { setEbook as setEbookModel } from '../../models/library/set-ebook';

/**
 * @swagger
 * /library/{bookId}/ebook:
 *   put:
 *     tags: [Library]
 *     summary: Mark a book as an ebook
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
 *     summary: Mark a book as a physical copy
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
function handle(isEbook: boolean) {
  return async function setEbook(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const bookId = parseInt(req.params.bookId as string, 10);

      if (Number.isNaN(bookId)) {
        res.status(400).json({ error: 'A numeric book id is required.' });
        return;
      }

      const entry = await setEbookModel(userId, bookId, isEbook);

      if (!entry) {
        res.status(404).json({ error: 'Library entry not found' });
        return;
      }

      res.json({ entry });
    } catch (error) {
      console.error('Error setting library format:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// PUT marks an ebook, DELETE returns it to physical -- the verb carries the
// state, so there is no body to parse and no way for the two to disagree.
export const markEbook = handle(true);
export const markPhysical = handle(false);
