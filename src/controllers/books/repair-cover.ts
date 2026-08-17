import { Request, Response } from 'express';
import { repairCover as repairCoverModel } from '../../models/books/repair-cover';

/**
 * @swagger
 * /books/{slug}/cover:
 *   post:
 *     tags: [Books]
 *     summary: Replace a book's unreachable cover with one from Google Books
 *     description: >
 *       Called by a reader's browser when a cover has not loaded within its
 *       patience (LOS-272). The report is a trigger, not an instruction: the
 *       server checks the existing URL itself and only replaces one that is
 *       genuinely unreachable, so a client cannot make the catalog churn.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: >
 *           The cover to use. `repaired` when it was replaced, `alive` when the
 *           existing one answered after all, `no_replacement` when nothing
 *           suitable was found and the row was left alone.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 outcome: { type: string, enum: [repaired, alive, no_replacement] }
 *                 coverUrl: { type: string, nullable: true }
 *       404:
 *         description: No such book, or it has no cover to repair
 */
export async function repairCover(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;
    const result = await repairCoverModel(slug);

    if (result.outcome === 'not_found') {
      res.status(404).json({ error: 'No book with a cover to repair' });
      return;
    }

    res.json({
      outcome: result.outcome,
      coverUrl: result.outcome === 'no_replacement' ? null : result.coverUrl,
    });
  } catch (error) {
    console.error('Error repairing book cover:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
