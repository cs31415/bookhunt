import { isProviderEnabled } from '../../lib/books/provider-chain';
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

  /*
   * Picked by which id the row carries, but only among providers the chain
   * allows (LOS-389). A row resolved by Open Library keeps its id forever, so
   * without this check a configuration naming Google alone would still call
   * Open Library for every one of those rows.
   */
  let provider: BooksProvider;
  let id: string;
  if (params.googleBooksId && isProviderEnabled('google_books')) {
    provider = 'google_books';
    id = params.googleBooksId;
  } else if (params.openLibraryId && isProviderEnabled('open_library')) {
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
