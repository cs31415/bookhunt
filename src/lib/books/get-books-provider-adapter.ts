import { BooksProvider, BooksProviderAdapter } from './books-types';
import { searchGoogleBooks, getGoogleBooksEditionDetails } from './google-books-adapter';
import { searchOpenLibrary } from './open-library-search-adapter';
import { fetchOpenLibraryEditionDetails } from './open-library-edition-adapter';
import { fetchOpenLibraryAuthorDetails } from './open-library-author-adapter';

const adapters: Record<BooksProvider, BooksProviderAdapter> = {
  google_books: {
    provider: 'google_books',
    search: searchGoogleBooks,
    getEditionDetails: getGoogleBooksEditionDetails,
  },
  open_library: {
    provider: 'open_library',
    search: searchOpenLibrary,
    getEditionDetails: fetchOpenLibraryEditionDetails,
    getAuthorDetails: fetchOpenLibraryAuthorDetails,
  },
};

export function getBooksProviderAdapter(provider: BooksProvider): BooksProviderAdapter {
  return adapters[provider];
}
