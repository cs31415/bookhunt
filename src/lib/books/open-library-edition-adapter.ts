import { OPENLIBRARY_API_URL, OPENLIBRARY_COVERS_URL } from './open-library-rate-limiter';
import { extractOpenLibraryTextField } from './extract-open-library-text-field';
import { loggedFetch } from './logged-fetch';
import { EditionDetails, SearchResult } from './books-types';

export async function fetchOpenLibraryEditionDetails(openLibraryId: string): Promise<EditionDetails> {
  const empty: EditionDetails = { description: null, publisher: null, pages: null };

  let edition: any;
  try {
    const response = await loggedFetch('open_library', `${OPENLIBRARY_API_URL}/books/${openLibraryId}.json`);
    if (!response.ok) return empty;
    edition = await response.json();
  } catch {
    return empty;
  }

  const publisher: string | null = edition.publishers?.[0] || null;
  const pages: number | null = edition.number_of_pages || null;
  let description = extractOpenLibraryTextField(edition.description);

  const workKey: string | undefined = edition.works?.[0]?.key;
  if (!description && workKey) {
    try {
      const response = await loggedFetch('open_library', `${OPENLIBRARY_API_URL}${workKey}.json`);
      if (response.ok) {
        const work: any = await response.json();
        description = extractOpenLibraryTextField(work.description);
      }
    } catch {
      // leave description null
    }
  }

  return { description, publisher, pages };
}

// Best-effort: the edition JSON has no resolved author names (only author keys)
// and no per-edition subjects, so `authors`/`categories` come back empty here.
export async function getOpenLibraryById(openLibraryId: string): Promise<SearchResult | null> {
  let edition: any;
  try {
    const response = await loggedFetch('open_library', `${OPENLIBRARY_API_URL}/books/${openLibraryId}.json`);
    if (!response.ok) return null;
    edition = await response.json();
  } catch {
    return null;
  }

  if (!edition?.title) return null;

  const isbns13: string[] = edition.isbn_13 || [];
  const coverId: number | undefined = edition.covers?.[0];

  return {
    googleBooksId: null,
    openLibraryId,
    title: edition.title,
    authors: [],
    year: edition.publish_date ? parseInt(edition.publish_date.match(/\d{4}/)?.[0] ?? '', 10) || null : null,
    publisher: edition.publishers?.[0] || null,
    pages: edition.number_of_pages || null,
    rating: null,
    coverUrl: coverId ? `${OPENLIBRARY_COVERS_URL}/b/id/${coverId}-M.jpg` : null,
    isbn13: isbns13[0] || null,
    language: null,
    blurb: extractOpenLibraryTextField(edition.description),
    categories: [],
    moods: [],
    inLibrary: false,
    libraryStatus: null,
    source: 'open_library' as const,
  };
}
