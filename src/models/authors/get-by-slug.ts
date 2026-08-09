import { getAuthorBySlug as fetchAuthorBySlug, getBooksByAuthor, updateAuthorDetails, createAuthor } from '../../data/authors-data';
import { getAuthorDetailsWithFallback } from '../../lib/books/get-author-details-with-fallback';
import { parseBooksProviderConfig } from '../../lib/books/parse-books-provider-config';
import { generateAuthorDetails } from '../ai/get-author-details';
import { searchBooks, matchLibraryEntries, SearchResult } from '../ai/search';
import { deslugify, slugifyName } from '../../lib/slug';

export { getBooksByAuthor };

export async function getAuthorBySlug(slug: string) {
  const author = await fetchAuthorBySlug(slug);
  if (!author) return null;
  if (author.birth_year && author.bio) return author;
  return enrichAuthor(author);
}

async function enrichAuthor(author: any) {
  let { birth_year: birthYear, bio } = author;

  if (!birthYear || !bio) {
    const chain = parseBooksProviderConfig('BOOKS_SEARCH_PROVIDERS');
    const details = await getAuthorDetailsWithFallback(chain, author.name);
    birthYear = birthYear || details.birthYear;
    bio = bio || details.bio;
  }

  if (!birthYear || !bio) {
    const aiDetails = await generateAuthorDetails(author.name, { birthYear, bio });
    birthYear = birthYear || aiDetails.birthYear;
    bio = bio || aiDetails.bio;
  }

  if (birthYear === author.birth_year && bio === author.bio) {
    return author;
  }
  return updateAuthorDetails(author.id, { birthYear, bio });
}

interface AuthorWork {
  bookId: number | null;
  slug: string | null;
  googleBooksId: string | null;
  openLibraryId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  pages: number | null;
  rating: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  language: string | null;
  blurb: string | null;
  inLibrary: boolean;
  libraryStatus: string | null;
  source: string | null;
}

function catalogBookToWork(book: any, authorName: string): AuthorWork {
  return {
    bookId: book.id,
    slug: book.slug,
    googleBooksId: book.google_books_id,
    openLibraryId: book.openlibrary_id,
    title: book.title,
    authors: [authorName],
    year: book.year,
    publisher: book.publisher,
    pages: book.pages,
    rating: book.rating,
    coverUrl: book.cover_url,
    isbn13: book.isbn13,
    language: book.language,
    blurb: book.blurb,
    inLibrary: false,
    libraryStatus: null,
    source: book.source,
  };
}

export async function getAuthorWorks(author: any, userId?: number): Promise<AuthorWork[]> {
  const catalogBooks = await getBooksByAuthor(author.id);
  const works = catalogBooks.map((b) => catalogBookToWork(b, author.name));

  const knownGoogleIds = new Set(works.map((w) => w.googleBooksId).filter(Boolean));
  const knownIsbns = new Set(works.map((w) => w.isbn13).filter(Boolean));

  const externalResults = await searchBooks(`inauthor:"${author.name}"`, 40);
  for (const result of externalResults) {
    const isDuplicate =
      (result.googleBooksId && knownGoogleIds.has(result.googleBooksId)) ||
      (result.isbn13 && knownIsbns.has(result.isbn13));
    if (!isDuplicate) {
      works.push({ ...result, bookId: null, slug: null });
    }
  }

  if (userId) {
    await matchLibraryEntries(userId, works);
  }

  return [...works.filter((w) => w.inLibrary), ...works.filter((w) => !w.inLibrary)];
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

// The de-slugified query loses the author's real casing (and can't tell us the
// canonical name when the slug is ambiguous), so recover it from what the
// provider actually credits: prefer the credited author whose own slug matches
// the requested one, else the most frequently credited author, else the
// title-cased query as a last resort.
function resolveAuthorName(results: SearchResult[], slug: string, fallbackQuery: string): string {
  const counts = new Map<string, number>();
  for (const result of results) {
    for (const author of result.authors) {
      if (author) counts.set(author, (counts.get(author) ?? 0) + 1);
    }
  }

  const exact = [...counts.keys()].find((name) => slugifyName(name) === slug);
  if (exact) return exact;

  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }

  return best ?? titleCase(fallbackQuery);
}

/**
 * Resolves an author that isn't in the catalog by de-slugifying the slug to a
 * name and looking them up live via the provider chain - this is how a
 * provider-sourced book's author link (e.g. followed from an uncataloged Book
 * Detail page) can load an Author page. Returns null when no provider knows the
 * author, so the route 404s. See LOS-149.
 *
 * The resolved author (with whatever biographical details enrichment produced)
 * is persisted so subsequent requests hit the catalog path instead of
 * re-resolving live (LOS-150). Enrichment failures degrade to null fields
 * rather than failing the whole page; the row is still written and later
 * requests can top up missing fields via enrichAuthor.
 *
 * Only the author is persisted here - the provider-returned works stay
 * uncataloged (bookId: null), matching the pre-LOS-150 behavior.
 */
export async function resolveProviderAuthor(slug: string, userId?: number) {
  const nameQuery = deslugify(slug);
  if (!nameQuery) return null;

  const results = await searchBooks(`inauthor:"${nameQuery}"`, 40);
  if (results.length === 0) return null;

  const name = resolveAuthorName(results, slug, nameQuery);

  let birthYear: number | null = null;
  let bio: string | null = null;
  try {
    const chain = parseBooksProviderConfig('BOOKS_SEARCH_PROVIDERS');
    const details = await getAuthorDetailsWithFallback(chain, name);
    birthYear = details.birthYear;
    bio = details.bio;

    if (!birthYear || !bio) {
      const aiDetails = await generateAuthorDetails(name, { birthYear, bio });
      birthYear = birthYear || aiDetails.birthYear;
      bio = bio || aiDetails.bio;
    }
  } catch (error) {
    console.error(`[authors] enrichment failed for "${name}", returning without details:`, error);
  }

  const works: AuthorWork[] = results.map((result) => ({ ...result, bookId: null, slug: null }));
  if (userId) {
    await matchLibraryEntries(userId, works);
  }
  const books = [...works.filter((w) => w.inLibrary), ...works.filter((w) => !w.inLibrary)];

  // Persist the resolved author so the next request for this slug hits the
  // catalog path (getAuthorBySlug) instead of re-resolving live (LOS-150).
  const author = await createAuthor({ slug, name, birthYear, bio });
  return { author, books };
}
