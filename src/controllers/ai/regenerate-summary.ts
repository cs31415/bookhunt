import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { regenerateSummary as regenerateSummaryModel } from '../../models/ai/regenerate-summary';

/**
 * @swagger
 * /ai/summary/{bookId}:
 *   post:
 *     tags: [AI]
 *     summary: Regenerate an AI book summary (skips cache)
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Freshly generated summary
 *       404:
 *         description: Book not found
 *       429:
 *         description: Rate limited (5/min)
 *       503:
 *         description: AI service unavailable
 */
export async function regenerateSummary(req: Request, res: Response) {
  try {
    const bookId = parseInt(req.params.bookId as string, 10);
    if (isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const result = await regenerateSummaryModel(bookId);
    if (!result) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error regenerating summary:', error);
    if (error instanceof Anthropic.APIError) {
      res.status(503).json({ error: 'AI service temporarily unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
