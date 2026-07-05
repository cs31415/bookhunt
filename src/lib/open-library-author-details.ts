import { throttleOpenLibrary, OPENLIBRARY_API_URL } from './open-library-rate-limiter';

type OpenLibraryBio = string | { value?: string } | undefined;

export interface OpenLibraryAuthorDetails {
  birthYear: number | null;
  bio: string | null;
}

function extractBio(bio: OpenLibraryBio): string | null {
  if (!bio) return null;
  return typeof bio === 'string' ? bio : bio.value ?? null;
}

function extractBirthYear(birthDate: string | undefined): number | null {
  const match = birthDate?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export async function fetchOpenLibraryAuthorDetails(name: string): Promise<OpenLibraryAuthorDetails> {
  const empty: OpenLibraryAuthorDetails = { birthYear: null, bio: null };

  await throttleOpenLibrary();

  let doc: any;
  try {
    const response = await fetch(`${OPENLIBRARY_API_URL}/search/authors.json?q=${encodeURIComponent(name)}`);
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
    const response = await fetch(`${OPENLIBRARY_API_URL}/authors/${doc.key}.json`);
    if (response.ok) {
      const author: any = await response.json();
      bio = extractBio(author.bio);
    }
  } catch {
    // leave bio null
  }

  return { birthYear, bio };
}
