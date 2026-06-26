import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { detectBooksFromImage } from '../../models/upload/scan';

export async function scan(req: Request, res: Response) {
  try {
    const { imageKey } = req.body;

    if (!imageKey) {
      res.status(400).json({ error: 'imageKey is required' });
      return;
    }

    const detectedBooks = await detectBooksFromImage(imageKey);
    res.json({ detectedBooks });
  } catch (error) {
    console.error('Error scanning bookshelf:', error);
    if (error instanceof Anthropic.APIError) {
      res.status(503).json({ error: 'Book detection service unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
