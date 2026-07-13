import { throttleOpenLibrary, OPENLIBRARY_API_URL } from './open-library-rate-limiter';
import { extractOpenLibraryTextField } from './extract-open-library-text-field';
import { loggedFetch } from './logged-fetch';
import { EditionDetails } from './books-types';

export async function fetchOpenLibraryEditionDetails(openLibraryId: string): Promise<EditionDetails> {
  const empty: EditionDetails = { description: null, publisher: null, pages: null };

  await throttleOpenLibrary();

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
    await throttleOpenLibrary();
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
