import { throttleOpenLibrary } from './open-library-rate-limiter';

type OpenLibraryDescription = string | { value?: string } | undefined;

export interface OpenLibraryEditionDetails {
  description: string | null;
  publisher: string | null;
  pages: number | null;
}

function extractDescription(description: OpenLibraryDescription): string | null {
  if (!description) return null;
  return typeof description === 'string' ? description : description.value ?? null;
}

export async function fetchOpenLibraryEditionDetails(
  openLibraryId: string,
): Promise<OpenLibraryEditionDetails> {
  const empty: OpenLibraryEditionDetails = { description: null, publisher: null, pages: null };

  await throttleOpenLibrary();

  let edition: any;
  try {
    const response = await fetch(`https://openlibrary.org/books/${openLibraryId}.json`);
    if (!response.ok) return empty;
    edition = await response.json();
  } catch {
    return empty;
  }

  const publisher: string | null = edition.publishers?.[0] || null;
  const pages: number | null = edition.number_of_pages || null;
  let description = extractDescription(edition.description);

  const workKey: string | undefined = edition.works?.[0]?.key;
  if (!description && workKey) {
    await throttleOpenLibrary();
    try {
      const response = await fetch(`https://openlibrary.org${workKey}.json`);
      if (response.ok) {
        const work: any = await response.json();
        description = extractDescription(work.description);
      }
    } catch {
      // leave description null
    }
  }

  return { description, publisher, pages };
}
