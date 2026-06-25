import { Request, Response } from 'express';
import { updateEntry as updateEntryModel } from '../../models/library/update-entry';

export async function updateEntry(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);

    const entry = await updateEntryModel(userId, bookId, req.body);

    if (!entry) {
      res.status(404).json({ error: 'Library entry not found' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error updating library entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
