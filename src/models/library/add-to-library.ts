import { upsertBook, addToLibrary as addToLibraryData } from '../../data/library-data';
import { resolveEditionFields } from './resolve-edition-fields';
import { BooksProvider } from '../../lib/books/books-types';

interface AddToLibraryParams {
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

export async function addToLibrary(userId: number, params: AddToLibraryParams) {
  const resolved = await resolveEditionFields(params);
  const book = await upsertBook({ ...params, ...resolved });
  const entry = await addToLibraryData(userId, book.id, params.status ?? 'queued');

  // Deliberately not categorized here. This is the path the CSV import and the
  // photo scan use, one request per row and six at a time, so tagging here made
  // a 20-book import twenty LLM calls instead of one and blocked every add on a
  // round trip -- while giving the model no way to group, which was the point.
  // The client sends the ids to POST /ai/categorize once the import is done
  // (LOS-197).
  return { entry, book };
}
