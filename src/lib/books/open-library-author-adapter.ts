import { throttleOpenLibrary, OPENLIBRARY_API_URL } from './open-library-rate-limiter';
import { extractOpenLibraryTextField } from './extract-open-library-text-field';
import { loggedFetch } from './logged-fetch';
import { AuthorDetails } from './books-types';

function extractBirthYear(birthDate: string | undefined): number | null {
  const match = birthDate?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export async function fetchOpenLibraryAuthorDetails(name: string): Promise<AuthorDetails> {
  const empty: AuthorDetails = { birthYear: null, bio: null };

  await throttleOpenLibrary();

  let doc: any;
  try {
    const response = await loggedFetch('open_library', `${OPENLIBRARY_API_URL}/search/authors.json?q=${encodeURIComponent(name)}`);
    if (!response.ok) return empty;
    const results: any = await response.json();
    const docs: any[] = results.docs ?? [];
    doc = docs.find((d) => d.birth_date) ?? docs[0];
  } catch {
    return empty;
  }

  if (!doc) return empty;

  const birthYear = extractBirthYear(doc.birth_date);

  await throttleOpenLibrary();

  let bio: string | null = null;
  try {
    const response = await loggedFetch('open_library', `${OPENLIBRARY_API_URL}/authors/${doc.key}.json`);
    if (response.ok) {
      const author: any = await response.json();
      bio = extractOpenLibraryTextField(author.bio);
    }
  } catch {
    // leave bio null
  }

  return { birthYear, bio };
}
