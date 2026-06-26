import { Request, Response } from 'express';
import { removeRelated as removeRelatedModel } from '../../models/library/remove-related';

export async function removeRelated(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);
    const relatedBookId = parseInt(req.params.relatedBookId as string, 10);

    const userRelated = await removeRelatedModel(userId, bookId, relatedBookId);

    res.json({ userRelated });
  } catch (error) {
    console.error('Error removing related book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
