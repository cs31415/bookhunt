import { upsertBook, addToLibrary as addToLibraryData } from '../../data/library-data';

interface BulkAddParams {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  source?: 'google_books' | 'open_library';
  slug: string;
  title: string;
  authorName: string;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[] | null;
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
  hue?: string | null;
  status?: string;
}

interface BulkAddError {
  index: number;
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  reason: string;
}

export async function bulkAddToLibrary(userId: number, books: BulkAddParams[]) {
  const seen = new Set<string>();
  const deduped = books.filter((book) => {
    const key = book.googleBooksId || book.openLibraryId;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const entries: unknown[] = [];
  const errors: BulkAddError[] = [];

  for (let i = 0; i < deduped.length; i++) {
    const params = deduped[i];
    try {
      console.log(`[bulk-add model] [${i + 1}/${deduped.length}] upserting "${params.title}"`);
      const book = await upsertBook(params);
      console.log(`[bulk-add model] [${i + 1}/${deduped.length}] upserted book id=${book.id}, adding to library`);
      const entry = await addToLibraryData(userId, book.id, params.status ?? 'queued');
      console.log(`[bulk-add model] [${i + 1}/${deduped.length}] done`);
      entries.push(entry);
    } catch (err) {
      console.error(`[bulk-add model] [${i + 1}/${deduped.length}] error:`, err);
      errors.push({
        index: i,
        googleBooksId: params.googleBooksId,
        openLibraryId: params.openLibraryId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { entries, errors };
}
