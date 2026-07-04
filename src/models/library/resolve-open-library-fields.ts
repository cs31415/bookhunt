import { fetchOpenLibraryEditionDetails } from '../../lib/open-library-edition-details';

interface OpenLibraryFieldSource {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  blurb?: string | null;
  publisher?: string | null;
  pages?: number | null;
}

interface ResolvedOpenLibraryFields {
  blurb?: string | null;
  publisher?: string | null;
  pages?: number | null;
}

export async function resolveOpenLibraryFields(
  params: OpenLibraryFieldSource,
): Promise<ResolvedOpenLibraryFields> {
  const needsLookup = !params.blurb || !params.publisher || !params.pages;

  if (params.googleBooksId || !params.openLibraryId || !needsLookup) {
    return { blurb: params.blurb, publisher: params.publisher, pages: params.pages };
  }

  const details = await fetchOpenLibraryEditionDetails(params.openLibraryId);

  return {
    blurb: params.blurb || details.description,
    publisher: params.publisher || details.publisher,
    pages: params.pages || details.pages,
  };
}
