import { Request, Response } from 'express';
import { getByIds } from '../../../controllers/books/get-by-ids';
import * as getByIdsModel from '../../../models/books/get-by-ids';

jest.mock('../../../models/books/get-by-ids');

const mockGetBooksByIds = getByIdsModel.getBooksByIds as jest.Mock;

function makeReq(query: Record<string, unknown>) {
  return { query } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('getByIds controller', () => {
  it('parses comma-separated ids, camelCases rows, and returns books', async () => {
    mockGetBooksByIds.mockResolvedValue([
      {
        book_id: 1,
        slug: 'a-book',
        title: 'A Book',
        author_name: 'Ann Author',
        author_slug: 'ann-author',
        year: 2001,
        rating: 4.5,
        cover_url: 'https://x/y.jpg',
        hue: '#123456',
      },
    ]);
    const res = makeRes();

    await getByIds(makeReq({ ids: '1,2,3' }), res);

    expect(mockGetBooksByIds).toHaveBeenCalledWith([1, 2, 3]);
    expect(res.json).toHaveBeenCalledWith({
      books: [
        {
          id: 1,
          slug: 'a-book',
          title: 'A Book',
          authorName: 'Ann Author',
          authorSlug: 'ann-author',
          year: 2001,
          rating: 4.5,
          coverUrl: 'https://x/y.jpg',
          hue: '#123456',
        },
      ],
    });
  });

  it('dedupes ids and caps at 40', async () => {
    mockGetBooksByIds.mockResolvedValue([]);
    const res = makeRes();
    const ids = Array.from({ length: 50 }, (_, i) => i + 1);

    await getByIds(makeReq({ ids: [...ids, 1, 2].join(',') }), res);

    const passed = mockGetBooksByIds.mock.calls[0][0];
    expect(passed).toHaveLength(40);
    expect(passed).toEqual(ids.slice(0, 40));
  });

  it('returns 400 when ids is missing', async () => {
    const res = makeRes();

    await getByIds(makeReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGetBooksByIds).not.toHaveBeenCalled();
  });

  it('returns 400 when ids has no valid numbers', async () => {
    const res = makeRes();

    await getByIds(makeReq({ ids: 'abc,,def' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on error', async () => {
    mockGetBooksByIds.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await getByIds(makeReq({ ids: '1' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
