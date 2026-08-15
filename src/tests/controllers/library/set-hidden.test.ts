import { Request, Response } from 'express';
import { hideEntry, showEntry } from '../../../controllers/library/set-hidden';
import * as setVisibilityModel from '../../../models/library/set-visibility';

jest.mock('../../../models/library/set-visibility');

const mockSetVisibility = setVisibilityModel.setVisibility as jest.Mock;

function makeReq(bookId: string) {
  return { user: { id: 7 }, params: { bookId } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const entry = { user_id: 7, book_id: 12, is_favorite: false, is_hidden: true };

beforeEach(() => {
  mockSetVisibility.mockResolvedValue(entry);
});

describe('set-hidden controller', () => {
  it('PUT hides the book', async () => {
    const res = makeRes();
    await hideEntry(makeReq('12'), res);

    expect(mockSetVisibility).toHaveBeenCalledWith(7, 12, true);
    expect(res.json).toHaveBeenCalledWith({ entry });
  });

  it('DELETE reveals it again', async () => {
    mockSetVisibility.mockResolvedValue({ ...entry, is_hidden: false });

    const res = makeRes();
    await showEntry(makeReq('12'), res);

    expect(mockSetVisibility).toHaveBeenCalledWith(7, 12, false);
    expect(res.json).toHaveBeenCalledWith({
      entry: { ...entry, is_hidden: false },
    });
  });

  it('returns 404 when the reader does not own the book', async () => {
    mockSetVisibility.mockResolvedValue(null);

    const res = makeRes();
    await hideEntry(makeReq('12'), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for a non-numeric book id', async () => {
    const res = makeRes();
    await hideEntry(makeReq('bulk'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSetVisibility).not.toHaveBeenCalled();
  });
});
