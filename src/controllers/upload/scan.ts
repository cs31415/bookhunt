import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { detectBooksFromImages } from '../../models/upload/scan';

export async function scan(req: Request, res: Response) {
  try {
    const { imageKeys } = req.body;

    if (!Array.isArray(imageKeys) || imageKeys.length === 0) {
      res.status(400).json({ error: 'imageKeys must be a non-empty array' });
      return;
    }

    if (imageKeys.length > 10) {
      res.status(400).json({ error: 'imageKeys must contain at most 10 items' });
      return;
    }

    if (!imageKeys.every((k) => typeof k === 'string')) {
      res.status(400).json({ error: 'imageKeys must be an array of strings' });
      return;
    }

    const detectedBooks = await detectBooksFromImages(imageKeys);
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
