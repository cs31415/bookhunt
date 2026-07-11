import { BooksProvider } from './books-types';

const VALID_PROVIDERS: BooksProvider[] = ['google_books', 'open_library'];
const DEFAULT_CHAIN: BooksProvider[] = ['google_books', 'open_library'];

export function parseBooksProviderConfig(envVarName: string): BooksProvider[] {
  const raw = process.env[envVarName];
  if (!raw?.trim()) return DEFAULT_CHAIN;

  return raw.split(',').map((entry) => {
    const provider = entry.trim();
    if (!VALID_PROVIDERS.includes(provider as BooksProvider)) {
      throw new Error(`Invalid ${envVarName} entry "${provider}": must be one of ${VALID_PROVIDERS.join(', ')}`);
    }
    return provider as BooksProvider;
  });
}
