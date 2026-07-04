import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getSummary as getSummaryModel } from '../../models/ai/get-summary';

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
    if (error instanceof Anthropic.APIError) {
      res.status(503).json({ error: 'AI service temporarily unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
