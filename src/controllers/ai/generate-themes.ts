import { Request, Response } from 'express';
import { LlmUnavailableError } from '../../lib/llm/llm-errors';
import { generateThemes as generateThemesModel } from '../../models/ai/generate-themes';

/**
 * @swagger
 * /ai/themes/{bookId}:
 *   post:
 *     tags: [AI]
 *     summary: Generate or return cached genres and themes for a book
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Genres and themes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 genres: { type: array, items: { type: string } }
 *                 themes: { type: array, items: { type: string } }
 *       404:
 *         description: Book not found
 *       429:
 *         description: Rate limited (10/min)
 *       503:
 *         description: AI service unavailable
 */
export async function generateThemes(req: Request, res: Response) {
  try {
    const bookId = parseInt(req.params.bookId as string, 10);
    if (isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const result = await generateThemesModel(bookId);
    if (!result) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating themes:', error);
    if (error instanceof LlmUnavailableError) {
      res.status(503).json({ error: 'AI service temporarily unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
