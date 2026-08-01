import { upsertBook, addToLibrary as addToLibraryData } from '../../data/library-data';
import { resolveEditionFields } from './resolve-edition-fields';
import { categorizeAddedBooks } from './categorize-added-books';
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

  // A batch of one still gets the catalog vocabulary, which is most of the
  // value here -- it is the grouping that needs several books at once.
  await categorizeAddedBooks([{ id: book.id, title: params.title, authorName: params.authorName }]);

  return { entry, book };
}
