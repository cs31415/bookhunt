import { categorizeBookIds } from '../../../models/ai/categorize-book-ids';
import { categorizeBooks } from '../../../models/ai/categorize-books';
import { pool } from '../../../lib/db';

jest.mock('../../../models/ai/categorize-books');
jest.mock('../../../lib/db', () => ({ pool: { query: jest.fn() } }));

const mockCategorizeBooks = categorizeBooks as jest.Mock;
const mockQuery = pool.query as unknown as jest.Mock;

function untaggedRows(count: number, startId = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    title: `Book ${startId + i}`,
    author_name: 'Anon',
  }));
}

describe('categorizeBookIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCategorizeBooks.mockResolvedValue([]);
  });

  it('does nothing for an empty list, without touching the database', async () => {
    expect(await categorizeBookIds([])).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockCategorizeBooks).not.toHaveBeenCalled();
  });

  it('does not call the model when every id is already tagged', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    expect(await categorizeBookIds([1, 2, 3])).toEqual([]);
    expect(mockCategorizeBooks).not.toHaveBeenCalled();
  });

  it('sends one batch for a whole import request', async () => {
    mockQuery.mockResolvedValue({ rows: untaggedRows(20) });

    await categorizeBookIds(Array.from({ length: 20 }, (_, i) => i + 1));

    // The regression this ticket exists for: 20 books used to mean 20 calls.
    expect(mockCategorizeBooks).toHaveBeenCalledTimes(1);
    expect(mockCategorizeBooks.mock.calls[0][0]).toHaveLength(20);
  });

  it('splits a longer list into batches, in sequence', async () => {
    mockQuery.mockResolvedValue({ rows: untaggedRows(45) });

    await categorizeBookIds(Array.from({ length: 45 }, (_, i) => i + 1));

    expect(mockCategorizeBooks).toHaveBeenCalledTimes(3);
    expect(mockCategorizeBooks.mock.calls.map((c) => c[0].length)).toEqual([20, 20, 5]);
  });

  it('de-dupes ids so a repeated one is not asked about twice', async () => {
    mockQuery.mockResolvedValue({ rows: untaggedRows(1) });

    await categorizeBookIds([7, 7, 7]);

    expect(mockQuery.mock.calls[0][1]).toEqual([[7]]);
  });

  it('caps how much one request can spend', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await categorizeBookIds(Array.from({ length: 500 }, (_, i) => i + 1));

    expect(mockQuery.mock.calls[0][1][0]).toHaveLength(200);
  });

  it('returns what was tagged', async () => {
    mockQuery.mockResolvedValue({ rows: untaggedRows(2) });
    mockCategorizeBooks.mockResolvedValue([{ id: 1, categories: ['Fiction'], themes: [], moods: [] }]);

    expect(await categorizeBookIds([1, 2])).toEqual([
      { id: 1, categories: ['Fiction'], themes: [], moods: [] },
    ]);
  });
});
