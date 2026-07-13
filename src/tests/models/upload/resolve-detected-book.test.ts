import { resolveDetectedBook } from '../../../models/upload/resolve-detected-book';
import * as aiSearch from '../../../models/ai/search';

jest.mock('../../../models/ai/search');

const mockSearchBooks = aiSearch.searchBooks as jest.Mock;

function result(title: string, authors: string[]) {
  return {
    googleBooksId: 'gb1', openLibraryId: null, title, authors, year: 2020,
    publisher: null, pages: null, rating: null, coverUrl: null, isbn13: null,
    language: null, blurb: null, inLibrary: false, libraryStatus: null,
    source: 'google_books' as const,
  };
}

describe('resolveDetectedBook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries with intitle/inauthor first and returns a matching result', async () => {
    const kagan = result('National Geographic Concise History of the World', ['Neil Kagan']);
    mockSearchBooks.mockResolvedValueOnce([kagan]);
    const resolved = await resolveDetectedBook('Concise History of the World', 'Kagan');
    expect(mockSearchBooks).toHaveBeenCalledTimes(1);
    expect(mockSearchBooks).toHaveBeenCalledWith(
      'intitle:"Concise History of the World" inauthor:"Kagan"',
      3,
    );
    expect(resolved).toBe(kagan);
  });

  it('omits inauthor when the detected author is null', async () => {
    mockSearchBooks.mockResolvedValueOnce([result('Elements', ['Theodore Gray'])]);
    await resolveDetectedBook('Elements', null);
    expect(mockSearchBooks).toHaveBeenCalledWith('intitle:"Elements"', 3);
  });

  it('falls back to free text when the fielded query returns nothing', async () => {
    const daulaires = result("D'Aulaires' Book of Greek Myths", ["Ingri d'Aulaire"]);
    mockSearchBooks.mockResolvedValueOnce([]).mockResolvedValueOnce([daulaires]);
    const resolved = await resolveDetectedBook("Dauiares' Book of Greek Myths", 'Doubleday');
    expect(mockSearchBooks).toHaveBeenNthCalledWith(
      2,
      "Dauiares' Book of Greek Myths Doubleday",
      5,
    );
    expect(resolved).toBe(daulaires);
  });

  it('skips non-matching free-text results and returns the first match', async () => {
    const wrong = result('Concise History of Science & Invention', ['Jolyon Goddard']);
    const right = result('National Geographic Concise History of the World', ['Neil Kagan']);
    mockSearchBooks.mockResolvedValueOnce([]).mockResolvedValueOnce([wrong, right]);
    const resolved = await resolveDetectedBook('Concise History of the World', 'Kagan');
    expect(resolved).toBe(right);
  });

  it('returns null when no candidate passes the overlap check', async () => {
    const wrong = result('Concise History of Science & Invention', ['Jolyon Goddard']);
    mockSearchBooks.mockResolvedValueOnce([wrong]).mockResolvedValueOnce([wrong]);
    expect(await resolveDetectedBook('Concise History of the World', 'Kagan')).toBeNull();
  });

  it('returns null when both queries return nothing', async () => {
    mockSearchBooks.mockResolvedValue([]);
    expect(await resolveDetectedBook('Obscure Book', null)).toBeNull();
  });

  it('strips embedded double quotes from the fielded query', async () => {
    mockSearchBooks.mockResolvedValue([]);
    await resolveDetectedBook('The "Real" Story', 'Jane "JJ" Doe');
    expect(mockSearchBooks).toHaveBeenNthCalledWith(
      1,
      'intitle:"The Real Story" inauthor:"Jane JJ Doe"',
      3,
    );
  });
});
