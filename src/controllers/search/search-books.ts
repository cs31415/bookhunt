import { Request, Response } from 'express';
import { searchBooks as searchBooksModel } from '../../models/search/search-books';

export async function searchBooks(req: Request, res: Response) {
  try {
    const userId = req.user?.id ?? null;
    const result = await searchBooksModel(req.query, userId);
    res.json(result);
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
