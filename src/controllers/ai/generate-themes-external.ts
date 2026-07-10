import { Request, Response } from 'express';
import { LlmUnavailableError } from '../../lib/llm/llm-errors';
import { generateThemesExternal as generateThemesExternalModel } from '../../models/ai/generate-themes-external';

/**
 * @swagger
 * /ai/themes/external:
 *   post:
 *     tags: [AI]
 *     summary: Generate genres and themes for a book not yet in the catalog
 *     description: For external search results (Google Books/OpenLibrary) with no bookId. Always calls Claude fresh; nothing is cached or persisted since there is no catalog row to attach it to. Must be registered before /ai/themes/{bookId} so the literal "external" segment is not swallowed by the bookId param.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, authorName]
 *             properties:
 *               title: { type: string }
 *               authorName: { type: string }
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
 *       400:
 *         description: Missing title or authorName
 *       429:
 *         description: Rate limited (10/min)
 *       503:
 *         description: AI service unavailable
 */
export async function generateThemesExternal(req: Request, res: Response) {
  try {
    const { title, authorName } = req.body;
    if (typeof title !== 'string' || !title.trim() || typeof authorName !== 'string' || !authorName.trim()) {
      res.status(400).json({ error: 'title and authorName are required' });
      return;
    }

    const result = await generateThemesExternalModel(title.trim(), authorName.trim());
    res.json(result);
  } catch (error) {
    console.error('Error generating themes for external book:', error);
    if (error instanceof LlmUnavailableError) {
      res.status(503).json({ error: 'AI service temporarily unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
