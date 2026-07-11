import { getAuthorBySlug as fetchAuthorBySlug, getBooksByAuthor, updateAuthorDetails } from '../../data/authors-data';
import { getAuthorDetailsWithFallback } from '../../lib/books/get-author-details-with-fallback';
import { parseBooksProviderConfig } from '../../lib/books/parse-books-provider-config';
import { generateAuthorDetails } from '../ai/get-author-details';
import { searchBooks, matchLibraryEntries } from '../ai/search';

export { getBooksByAuthor };

export async function getAuthorBySlug(slug: string) {
  const author = await fetchAuthorBySlug(slug);
  if (!author) return null;
  if (author.birth_year && author.country && author.bio) return author;
  return enrichAuthor(author);
}

async function enrichAuthor(author: any) {
  let { birth_year: birthYear, country, bio } = author;

  if (!birthYear || !bio) {
    const chain = parseBooksProviderConfig('BOOKS_SEARCH_PROVIDERS');
    const details = await getAuthorDetailsWithFallback(chain, author.name);
    birthYear = birthYear || details.birthYear;
    bio = bio || details.bio;
  }

  if (!birthYear || !country || !bio) {
    const aiDetails = await generateAuthorDetails(author.name, { birthYear, country, bio });
    birthYear = birthYear || aiDetails.birthYear;
    country = country || aiDetails.country;
    bio = bio || aiDetails.bio;
  }

  if (birthYear === author.birth_year && country === author.country && bio === author.bio) {
    return author;
  }
  return updateAuthorDetails(author.id, { birthYear, country, bio });
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
