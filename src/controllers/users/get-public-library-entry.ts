import { Request, Response } from 'express';
import { publicLibraryEntry } from '../../models/users/public-profile';

/**
 * @swagger
 * /users/{handle}/library/{bookId}:
 *   get:
 *     tags: [Users]
 *     summary: One reader's entry for one book, as a visitor may see it
 *     description: >
 *       Their status, rating and -- only if they published it -- their review.
 *       Goes through the same gated query as the shelf, so an unshared review
 *       comes back null exactly as it does there (LOS-360).
 *
 *       404 covers every way this can be unavailable: no such reader, a page
 *       that is not listed, a book they do not have, and one they hid. A
 *       visitor cannot tell those apart, which is the point.
 *     parameters:
 *       - in: path
 *         name: handle
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The entry
 *       400:
 *         description: A numeric book id is required
 *       404:
 *         description: No entry a visitor may see
 */
export async function getPublicLibraryEntry(req: Request, res: Response) {
  try {
    const handle = req.params.handle as string;
    const bookId = parseInt(req.params.bookId as string, 10);

    if (Number.isNaN(bookId)) {
      res.status(400).json({ error: 'A numeric book id is required.' });
      return;
    }

    const entry = await publicLibraryEntry(handle, bookId);

    if (!entry) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error fetching public library entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
