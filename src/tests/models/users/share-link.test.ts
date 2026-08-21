import {
  libraryByToken,
  myShareToken,
  profileByToken,
  regenerateShareToken,
  revokeShareToken,
} from '../../../models/users/share-link';
import {
  getLibraryByToken,
  getProfileByToken,
  getShareToken,
  setShareToken,
} from '../../../data/users-data';

jest.mock('../../../data/users-data');

const mockGetToken = getShareToken as jest.Mock;
const mockSetToken = setShareToken as jest.Mock;
const mockGetProfile = getProfileByToken as jest.Mock;
const mockGetLibrary = getLibraryByToken as jest.Mock;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('the unlisted share token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetToken.mockImplementation((_id, token) => Promise.resolve(token));
    mockGetLibrary.mockResolvedValue([]);
  });

  it('is null until a reader asks for one', async () => {
    mockGetToken.mockResolvedValue(null);

    expect(await myShareToken(1)).toBeNull();
  });

  it('mints a random token rather than deriving one', async () => {
    await regenerateShareToken(1);

    const [, token] = mockSetToken.mock.calls[0];
    expect(token).toMatch(UUID);
  });

  // Holding one link must tell you nothing about anybody else's.
  it('gives two readers unrelated tokens', async () => {
    await regenerateShareToken(1);
    await regenerateShareToken(2);

    expect(mockSetToken.mock.calls[0][1]).not.toBe(mockSetToken.mock.calls[1][1]);
  });

  // Creating and regenerating are the same call on purpose: overwriting is the
  // only way to take back a link that has spread.
  it('replaces the old token when regenerating', async () => {
    const first = (await regenerateShareToken(1)) as string;
    const second = (await regenerateShareToken(1)) as string;

    expect(second).not.toBe(first);
    expect(second).toMatch(UUID);
  });

  it('revokes by writing null, which is what private means', async () => {
    await revokeShareToken(1);

    expect(mockSetToken).toHaveBeenCalledWith(1, null);
  });
});

describe('reading a profile by token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLibrary.mockResolvedValue([]);
  });

  it('maps the row the way the public profile does', async () => {
    mockGetProfile.mockResolvedValue({
      handle: 'ada',
      display_name: 'Ada Reader',
      created_at: '2026-01-01T00:00:00Z',
      total_books: '12',
      reading_count: '2',
      finished_count: '7',
      favorite_count: '3',
    });

    expect(await profileByToken('tok')).toEqual({
      handle: 'ada',
      displayName: 'Ada Reader',
      joinedAt: '2026-01-01T00:00:00Z',
      counts: { total: 12, reading: 2, finished: 7, favorites: 3 },
    });
  });

  // A different answer for each would say whether a token had ever been valid.
  it('answers null for an unknown and a revoked token alike', async () => {
    mockGetProfile.mockResolvedValue(null);

    expect(await profileByToken('never-existed')).toBeNull();
    expect(await profileByToken('was-revoked')).toBeNull();
  });
});

describe('the shared shelf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLibrary.mockResolvedValue([]);
  });

  // Shared parsing rather than a copy, so the two addresses cannot drift.
  it('takes the same search and category filters the public shelf does', async () => {
    await libraryByToken('tok', { q: 'dune', subject: 'Fiction' });

    expect(mockGetLibrary).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ query: 'dune', subject: 'Fiction' }),
    );
  });

  it('pages the same way', async () => {
    await libraryByToken('tok', { page: 3, limit: 24 });

    expect(mockGetLibrary).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ limit: 24, offset: 48 }),
    );
  });

  it('narrows to nothing on an unrecognised status, as the public shelf does', async () => {
    const result = await libraryByToken('tok', { status: 'nonsense' });

    expect(result.entries).toEqual([]);
    expect(mockGetLibrary).not.toHaveBeenCalled();
  });

  it('reads the window count off the first row', async () => {
    mockGetLibrary.mockResolvedValue([{ total_count: '42' }, { total_count: '42' }]);

    expect((await libraryByToken('tok', {})).total).toBe(42);
  });
});
