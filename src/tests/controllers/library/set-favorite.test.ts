import { Request, Response } from 'express';
import { addFavorite, removeFavorite } from '../../../controllers/library/set-favorite';
import * as setFavoriteModel from '../../../models/library/set-favorite';

jest.mock('../../../models/library/set-favorite');

const mockSetFavorite = setFavoriteModel.setFavorite as jest.Mock;

function makeReq(bookId: string) {
  return { user: { id: 7 }, params: { bookId } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const entry = { user_id: 7, book_id: 12, is_favorite: true, is_hidden: false };

beforeEach(() => {
  mockSetFavorite.mockResolvedValue(entry);
});

describe('set-favorite controller', () => {
  it('PUT sets the flag on', async () => {
    const res = makeRes();
    await addFavorite(makeReq('12'), res);

    expect(mockSetFavorite).toHaveBeenCalledWith(7, 12, true);
    expect(res.json).toHaveBeenCalledWith({ entry });
  });

  it('DELETE sets the flag off', async () => {
    // The case fn_update_library_entry could not express: a COALESCE update
    // reads false as "unchanged", which is why this is a separate function.
    mockSetFavorite.mockResolvedValue({ ...entry, is_favorite: false });

    const res = makeRes();
    await removeFavorite(makeReq('12'), res);

    expect(mockSetFavorite).toHaveBeenCalledWith(7, 12, false);
    expect(res.json).toHaveBeenCalledWith({
      entry: { ...entry, is_favorite: false },
    });
  });

  it('returns 404 when the reader does not own the book', async () => {
    mockSetFavorite.mockResolvedValue(null);

    const res = makeRes();
    await addFavorite(makeReq('12'), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Library entry not found' });
  });

  it('returns 400 for a non-numeric book id', async () => {
    const res = makeRes();
    await addFavorite(makeReq('bulk'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSetFavorite).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected error', async () => {
    mockSetFavorite.mockRejectedValue(new Error('DB error'));

    const res = makeRes();
    await addFavorite(makeReq('12'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
