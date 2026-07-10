import { Request, Response } from 'express';
import { LlmUnavailableError } from '../../lib/llm/llm-errors';
import { getSummary as getSummaryModel } from '../../models/ai/get-summary';

/**
 * @swagger
 * /ai/summary/{bookId}:
 *   get:
 *     tags: [AI]
 *     summary: Get a book summary, preferring the stored catalog blurb over AI generation
 *     description: Returns the book's stored blurb (from the books API) when available. Only calls the LLM to generate a summary when no blurb is stored for the book.
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Book summary (catalog blurb or AI-generated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookId: { type: integer }
 *                 summary: { type: string }
 *                 generatedAt: { type: string, format: date-time, nullable: true, description: "Null when summary is the stored catalog blurb rather than AI-generated" }
 *       404:
 *         description: Book not found
 *       503:
 *         description: AI service unavailable
 */
export async function getSummary(req: Request, res: Response) {
  try {
    const bookId = parseInt(req.params.bookId as string, 10);
    if (isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const result = await getSummaryModel(bookId);
    if (!result) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating summary:', error);
    if (error instanceof LlmUnavailableError) {
      res.status(503).json({ error: 'AI service temporarily unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
