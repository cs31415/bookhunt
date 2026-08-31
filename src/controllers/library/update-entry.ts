import { Request, Response } from 'express';
import { updateEntry as updateEntryModel } from '../../models/library/update-entry';

/**
 * @swagger
 * /library/{bookId}:
 *   put:
 *     tags: [Library]
 *     summary: Update a library entry (status, rating, review)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [queued, reading, finished, abandoned] }
 *               userRating: { type: integer, minimum: 1, maximum: 5 }

 *               review: { type: string }
 *     responses:
 *       200:
 *         description: Updated entry
 *       404:
 *         description: Entry not found
 */
export async function updateEntry(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);

    const entry = await updateEntryModel(userId, bookId, req.body);

    if (!entry) {
      res.status(404).json({ error: 'Library entry not found' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error updating library entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
