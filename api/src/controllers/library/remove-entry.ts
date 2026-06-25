import { Request, Response } from 'express';
import { removeEntry as removeEntryModel } from '../../models/library/remove-entry';

export async function removeEntry(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);

    const removed = await removeEntryModel(userId, bookId);

    if (!removed) {
      res.status(404).json({ error: 'Library entry not found' });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error removing from library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
