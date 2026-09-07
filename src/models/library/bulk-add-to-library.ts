import { upsertBook, addToLibrary as addToLibraryData } from '../../data/library-data';
import { resolveEditionFields } from './resolve-edition-fields';
import { categorizeAddedBooks } from './categorize-added-books';
import { BookToCategorize } from '../ai/categorize-books';
import { BooksProvider } from '../../lib/books/books-types';

interface BulkAddParams {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  source?: BooksProvider;
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
  /** Named so the summary can say which book, not just which row (LOS-392). */
  title?: string;
  authorName?: string;
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
  const added: BookToCategorize[] = [];

  for (let i = 0; i < deduped.length; i++) {
    const params = deduped[i];
    try {
      console.log(`[bulk-add model] [${i + 1}/${deduped.length}] upserting "${params.title}"`);
      const resolved = await resolveEditionFields(params);
      const book = await upsertBook({ ...params, ...resolved });
      console.log(`[bulk-add model] [${i + 1}/${deduped.length}] upserted book id=${book.id}, adding to library`);
      const entry = await addToLibraryData(userId, book.id, params.status ?? 'queued');
      console.log(`[bulk-add model] [${i + 1}/${deduped.length}] done`);
      entries.push(entry);
      added.push({ id: book.id, title: params.title, authorName: params.authorName });
    } catch (err) {
      console.error(`[bulk-add model] [${i + 1}/${deduped.length}] error:`, err);
      errors.push({
        index: i,
        googleBooksId: params.googleBooksId,
        openLibraryId: params.openLibraryId,
        title: params.title,
        authorName: params.authorName,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /*
   * Once at the end, naming every book that did not make it (LOS-392). The
   * per-row lines above are written as the import runs and scroll away at any
   * real size, so without this a partial import finishes looking like a
   * complete one.
   *
   * Silent when nothing failed, so output means something went wrong.
   */
  if (errors.length > 0) {
    console.warn(`\n[import] ${errors.length} of ${deduped.length} books failed to save:`);
    for (const error of errors) {
      const who = error.authorName ? `${error.title} by ${error.authorName}` : error.title;
      console.warn(`  ${who}\n    ${error.reason}`);
    }
  }

  // One call for the whole request, after the upserts: the model needs to see
  // the books together to group them, and it cannot do that one at a time.
  await categorizeAddedBooks(added);

  return { entries, errors };
}
