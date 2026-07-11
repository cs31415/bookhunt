import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { BooksProvider } from '../../lib/books/books-types';

interface EditionFieldSource {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  blurb?: string | null;
  publisher?: string | null;
  pages?: number | null;
}

interface ResolvedEditionFields {
  blurb?: string | null;
  publisher?: string | null;
  pages?: number | null;
}

export async function resolveEditionFields(params: EditionFieldSource): Promise<ResolvedEditionFields> {
  const needsLookup = !params.blurb || !params.publisher || !params.pages;
  const unchanged = { blurb: params.blurb, publisher: params.publisher, pages: params.pages };

  if (!needsLookup) return unchanged;

  let provider: BooksProvider;
  let id: string;
  if (params.googleBooksId) {
    provider = 'google_books';
    id = params.googleBooksId;
  } else if (params.openLibraryId) {
    provider = 'open_library';
    id = params.openLibraryId;
  } else {
    return unchanged;
  }

  const adapter = getBooksProviderAdapter(provider);
  if (!adapter.getEditionDetails) return unchanged;

  const details = await adapter.getEditionDetails(id);

  return {
    blurb: params.blurb || details.description,
    publisher: params.publisher || details.publisher,
    pages: params.pages || details.pages,
  };
}
