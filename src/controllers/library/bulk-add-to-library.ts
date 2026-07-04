import { Request, Response } from 'express';
import { bulkAddToLibrary as bulkAddToLibraryModel } from '../../models/library/bulk-add-to-library';

const VALID_STATUSES = new Set(['queued', 'reading', 'finished', 'abandoned']);
const MAX_BOOKS = 20;

export async function bulkAddToLibrary(req: Request, res: Response) {
  const { books } = req.body;
  console.log(`[bulk-add] request body:`, JSON.stringify(req.body, null, 2));

  if (!Array.isArray(books) || books.length === 0) {
    return res.status(400).json({ error: 'books must be a non-empty array' });
  }

  if (books.length > MAX_BOOKS) {
    return res.status(400).json({ error: `books must contain at most ${MAX_BOOKS} items` });
  }

  for (const book of books) {
    if ((!book.googleBooksId && !book.openLibraryId) || !book.slug || !book.title || !book.authorName) {
      return res.status(400).json({ error: 'each book requires (googleBooksId or openLibraryId), slug, title, and authorName' });
    }
    if (book.status !== undefined && !VALID_STATUSES.has(book.status)) {
      return res.status(400).json({ error: `invalid status: ${book.status}` });
    }
  }

  try {
    const userId = req.user!.id;
    console.log(`[bulk-add] user ${userId} — starting upsert of ${books.length} books`);
    for (let i = 0; i < books.length; i++) {
      console.log(`[bulk-add] [${i + 1}/${books.length}] "${books[i].title}" (${books[i].googleBooksId})`);
    }
    const { entries, errors } = await bulkAddToLibraryModel(userId, books);
    const status = errors.length > 0 ? 207 : 201;
    console.log(`[bulk-add] done — ${entries.length} added, ${errors.length} failed → ${status}`);
    return res.status(status).json({ entries, errors });
  } catch (error) {
    console.error('[bulk-add] unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
