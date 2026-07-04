import { resolveOpenLibraryFields } from '../../../models/library/resolve-open-library-fields';
import { fetchOpenLibraryEditionDetails } from '../../../lib/open-library-edition-details';

jest.mock('../../../lib/open-library-edition-details');

const mockFetchDetails = fetchOpenLibraryEditionDetails as jest.Mock;

describe('resolveOpenLibraryFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches OpenLibrary details for an OL-only book missing blurb/publisher/pages', async () => {
    mockFetchDetails.mockResolvedValue({
      description: 'Fetched description',
      publisher: 'Fetched Press',
      pages: 200,
    });

    const result = await resolveOpenLibraryFields({ openLibraryId: 'OL1M' });

    expect(mockFetchDetails).toHaveBeenCalledWith('OL1M');
    expect(result).toEqual({ blurb: 'Fetched description', publisher: 'Fetched Press', pages: 200 });
  });

  it('does not overwrite fields that are already present', async () => {
    mockFetchDetails.mockResolvedValue({
      description: 'Fetched description',
      publisher: 'Fetched Press',
      pages: 200,
    });

    const result = await resolveOpenLibraryFields({
      openLibraryId: 'OL1M',
      blurb: 'Existing blurb',
      publisher: 'Existing Press',
    });

    expect(result).toEqual({ blurb: 'Existing blurb', publisher: 'Existing Press', pages: 200 });
  });

  it('skips the lookup entirely when googleBooksId is present', async () => {
    const result = await resolveOpenLibraryFields({
      googleBooksId: 'gid1',
      openLibraryId: 'OL1M',
    });

    expect(mockFetchDetails).not.toHaveBeenCalled();
    expect(result).toEqual({ blurb: undefined, publisher: undefined, pages: undefined });
  });

  it('skips the lookup when there is no openLibraryId', async () => {
    const result = await resolveOpenLibraryFields({});

    expect(mockFetchDetails).not.toHaveBeenCalled();
    expect(result).toEqual({ blurb: undefined, publisher: undefined, pages: undefined });
  });

  it('skips the lookup when blurb, publisher, and pages are all already present', async () => {
    const result = await resolveOpenLibraryFields({
      openLibraryId: 'OL1M',
      blurb: 'Existing blurb',
      publisher: 'Existing Press',
      pages: 100,
    });

    expect(mockFetchDetails).not.toHaveBeenCalled();
    expect(result).toEqual({ blurb: 'Existing blurb', publisher: 'Existing Press', pages: 100 });
  });
});
