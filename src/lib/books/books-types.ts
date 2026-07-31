export type BooksProvider = 'google_books' | 'open_library';

export interface SearchResult {
  googleBooksId: string | null;
  openLibraryId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  /** Single canonical publisher, as consumed by fn_upsert_book. */
  publisher: string | null;
  /**
   * Every publisher a provider reports for this work. Open Library aggregates
   * across editions, so one work can list "Frommer's", "Frommers" and
   * "*Frommers" — matching a supplied publisher hint needs all of them, not
   * just the first. Google Books reports at most one, and often none at all in
   * search results.
   */
  publishers?: string[];
  pages: number | null;
  rating: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  language: string | null;
  blurb: string | null;
  categories: string[];
  moods: string[];
  inLibrary: boolean;
  libraryStatus: string | null;
  // 'google_books' | 'open_library', or the specific LLM model name (e.g. 'gemini-3.1-flash-lite') that answered the fallback search
  source: string;
}

export interface EditionDetails {
  description: string | null;
  publisher: string | null;
  pages: number | null;
}

export interface AuthorDetails {
  birthYear: number | null;
  bio: string | null;
}

export interface BooksProviderAdapter {
  provider: BooksProvider;
  search: (query: string, limit: number) => Promise<SearchResult[]>;
  getById?: (id: string) => Promise<SearchResult | null>;
  getEditionDetails?: (id: string) => Promise<EditionDetails>;
  getAuthorDetails?: (name: string) => Promise<AuthorDetails>;
}
