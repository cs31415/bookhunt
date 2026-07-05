import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { generateThemesExternal as generateThemesExternalModel } from '../../models/ai/generate-themes-external';

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
    if (error instanceof Anthropic.APIError) {
      res.status(503).json({ error: 'AI service temporarily unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
