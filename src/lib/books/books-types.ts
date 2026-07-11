export type BooksProvider = 'google_books' | 'open_library';

export interface SearchResult {
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
  categories: string[];
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
  getEditionDetails?: (id: string) => Promise<EditionDetails>;
  getAuthorDetails?: (name: string) => Promise<AuthorDetails>;
}
