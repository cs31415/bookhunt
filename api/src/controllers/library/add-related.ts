import { Request, Response } from 'express';
import { addRelated as addRelatedModel } from '../../models/library/add-related';

export async function addRelated(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);
    const { relatedBookId } = req.body;

    const userRelated = await addRelatedModel(userId, bookId, relatedBookId);

    res.json({ userRelated });
  } catch (error) {
    console.error('Error adding related book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
