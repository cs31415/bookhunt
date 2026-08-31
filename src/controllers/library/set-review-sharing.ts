import { Request, Response } from 'express';
import { setReviewSharing as setReviewSharingModel } from '../../models/library/set-review-sharing';

/**
 * @swagger
 * /library/{bookId}/review-sharing:
 *   put:
 *     tags: [Library]
 *     summary: Publish, hold back, or defer one review
 *     description: >
 *       Three states, so this carries a body where the favourite and hidden
 *       flags carry only a verb: true always shows the review, false always
 *       hides it, and null follows the reader's global setting. Null is a value
 *       here, not an absence -- it is how a book is put back to Default.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               share: { type: boolean, nullable: true }
 *     responses:
 *       200:
 *         description: The updated sharing state
 *       400:
 *         description: A numeric book id and a boolean-or-null share are required
 *       404:
 *         description: Entry not found
 */
export async function setReviewSharing(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);

    if (Number.isNaN(bookId)) {
      res.status(400).json({ error: 'A numeric book id is required.' });
      return;
    }

    const { share } = req.body as { share?: unknown };

    // Null is meaningful and undefined is not, so they are told apart rather
    // than collapsed: a body with no `share` at all is a malformed request,
    // while `{"share": null}` is the reader asking for Default.
    if (share !== null && typeof share !== 'boolean') {
      res.status(400).json({ error: 'share must be true, false, or null.' });
      return;
    }

    const entry = await setReviewSharingModel(userId, bookId, share);

    if (!entry) {
      res.status(404).json({ error: 'Library entry not found' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error setting review sharing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
