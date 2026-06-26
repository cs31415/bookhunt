import { Request, Response } from 'express';
import { getBookBySlug, getLibraryEntry } from '../../models/books/get-by-slug';

export async function getBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;

    const book = await getBookBySlug(slug);

    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    let inLibrary = false;
    let libraryEntry: Record<string, unknown> | undefined;

    if (req.user) {
      const entry = await getLibraryEntry(req.user.id, book.id);
      if (entry) {
        inLibrary = true;
        libraryEntry = entry;
      }
    }

    res.json({
      book,
      inLibrary,
      ...(inLibrary && { libraryEntry }),
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
