import { Request, Response } from 'express';
import { addToLibrary as addToLibraryModel } from '../../models/library/add-to-library';

export async function addToLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const entry = await addToLibraryModel(userId, req.body);
    res.json({ entry });
  } catch (error) {
    console.error('Error adding to library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
