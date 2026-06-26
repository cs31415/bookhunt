import { Request, Response } from 'express';
import { searchBooks, matchLibraryEntries } from '../../models/ai/search';

export async function search(req: Request, res: Response) {
  try {
    const { query, inLibraryOnly = false, limit = 20 } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }

    const books = await searchBooks(query, limit);

    if (req.user && books.length > 0) {
      await matchLibraryEntries(req.user.id, books);
    }

    let results = books;
    if (inLibraryOnly) {
      results = books.filter((b) => b.inLibrary);
    } else {
      results = [
        ...books.filter((b) => b.inLibrary),
        ...books.filter((b) => !b.inLibrary),
      ];
    }

    res.json({ books: results, query });
  } catch (error) {
    console.error('Error in AI search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
