import { Request, Response } from 'express';
import { getLibrary as getLibraryModel } from '../../models/library/get-library';

export async function getLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const result = await getLibraryModel(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
