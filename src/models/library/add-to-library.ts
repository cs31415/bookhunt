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
  /**
   * Whether to go to the provider for whatever this payload is missing.
   *
   * Defaults to true, which is right when a reader is adding one book and
   * waiting on it. An import sets it false: the fields it did not send are the
   * ones the provider's *search* response never carried — publisher above all,
   * which google-books-adapter notes is "dependable only via the volume detail
   * endpoint" — so enriching means one network round trip per row, for data the
   * import did not stop to fetch on purpose (LOS-202).
   *
   * What is skipped here is filled in later, on first view of the book. See
   * enrichBookDetails in models/books/get-by-slug.
   */
  enrich?: boolean;
}

export async function addToLibrary(userId: number, params: AddToLibraryParams) {
  const resolved = params.enrich === false ? {} : await resolveEditionFields(params);
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
