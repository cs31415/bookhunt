import { resolveEditionFields } from '../../../models/library/resolve-edition-fields';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';

jest.mock('../../../lib/books/get-books-provider-adapter');

const mockGetAdapter = getBooksProviderAdapter as jest.Mock;

describe('resolveEditionFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches OpenLibrary details for an OL-only book missing blurb/publisher/pages', async () => {
    const mockGetEditionDetails = jest.fn().mockResolvedValue({
      description: 'Fetched description',
      publisher: 'Fetched Press',
      pages: 200,
    });
    mockGetAdapter.mockReturnValue({ provider: 'open_library', search: jest.fn(), getEditionDetails: mockGetEditionDetails });

    const result = await resolveEditionFields({ openLibraryId: 'OL1M' });

    expect(mockGetAdapter).toHaveBeenCalledWith('open_library');
    expect(mockGetEditionDetails).toHaveBeenCalledWith('OL1M');
    expect(result).toEqual({ blurb: 'Fetched description', publisher: 'Fetched Press', pages: 200 });
  });

  it('fetches Google Books details for a Google-sourced book missing blurb/publisher/pages', async () => {
    const mockGetEditionDetails = jest.fn().mockResolvedValue({
      description: 'Google description',
      publisher: 'Google Press',
      pages: 150,
    });
    mockGetAdapter.mockReturnValue({ provider: 'google_books', search: jest.fn(), getEditionDetails: mockGetEditionDetails });

    const result = await resolveEditionFields({ googleBooksId: 'gid1' });

    expect(mockGetAdapter).toHaveBeenCalledWith('google_books');
    expect(mockGetEditionDetails).toHaveBeenCalledWith('gid1');
    expect(result).toEqual({ blurb: 'Google description', publisher: 'Google Press', pages: 150 });
  });

  it('prefers google_books when both IDs are present', async () => {
    const mockGetEditionDetails = jest.fn().mockResolvedValue({ description: null, publisher: null, pages: null });
    mockGetAdapter.mockReturnValue({ provider: 'google_books', search: jest.fn(), getEditionDetails: mockGetEditionDetails });

    await resolveEditionFields({ googleBooksId: 'gid1', openLibraryId: 'OL1M' });

    expect(mockGetAdapter).toHaveBeenCalledWith('google_books');
    expect(mockGetEditionDetails).toHaveBeenCalledWith('gid1');
  });

  it('does not overwrite fields that are already present', async () => {
    const mockGetEditionDetails = jest.fn().mockResolvedValue({
      description: 'Fetched description',
      publisher: 'Fetched Press',
      pages: 200,
    });
    mockGetAdapter.mockReturnValue({ provider: 'open_library', search: jest.fn(), getEditionDetails: mockGetEditionDetails });

    const result = await resolveEditionFields({
      openLibraryId: 'OL1M',
      blurb: 'Existing blurb',
      publisher: 'Existing Press',
    });

    expect(result).toEqual({ blurb: 'Existing blurb', publisher: 'Existing Press', pages: 200 });
  });

  it('skips the lookup when there is no id at all', async () => {
    const result = await resolveEditionFields({});

    expect(mockGetAdapter).not.toHaveBeenCalled();
    expect(result).toEqual({ blurb: undefined, publisher: undefined, pages: undefined });
  });

  it('skips the lookup when blurb, publisher, and pages are all already present', async () => {
    const result = await resolveEditionFields({
      openLibraryId: 'OL1M',
      blurb: 'Existing blurb',
      publisher: 'Existing Press',
      pages: 100,
    });

    expect(mockGetAdapter).not.toHaveBeenCalled();
    expect(result).toEqual({ blurb: 'Existing blurb', publisher: 'Existing Press', pages: 100 });
  });

  it('returns unchanged fields when the resolved provider has no getEditionDetails capability', async () => {
    mockGetAdapter.mockReturnValue({ provider: 'google_books', search: jest.fn() });

    const result = await resolveEditionFields({ googleBooksId: 'gid1' });

    expect(result).toEqual({ blurb: undefined, publisher: undefined, pages: undefined });
  });
});
