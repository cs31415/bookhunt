import { Request, Response } from 'express';
import { addExistingToLibrary as addExistingToLibraryModel } from '../../models/library/add-existing-to-library';

const VALID_STATUSES = new Set(['queued', 'reading', 'finished', 'abandoned']);

/**
 * @swagger
 * /library/{bookId}:
 *   post:
 *     tags: [Library]
 *     summary: Add an existing catalog book to the library by internal id
 *     description: Idempotent — unlike POST /library, this does not upsert a books row, so it's safe to call for books already in the catalog (e.g. from the Book Detail page).
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
 *               status: { type: string, enum: [queued, reading, finished, abandoned], default: queued }
 *     responses:
 *       200:
 *         description: Library entry (existing or newly created)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entry: { type: object }
 *       400:
 *         description: Invalid bookId or status
 */
export async function addExistingToLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);

    if (!Number.isFinite(bookId)) {
      res.status(400).json({ error: 'Invalid bookId' });
      return;
    }

    const status = req.body?.status ?? 'queued';
    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const entry = await addExistingToLibraryModel(userId, bookId, status);
    res.json({ entry });
  } catch (error) {
    console.error('Error adding existing book to library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
