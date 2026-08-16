import { Request, Response } from 'express';
import { markEbook, markPhysical } from '../../../controllers/library/set-ebook';
import * as setEbookModel from '../../../models/library/set-ebook';

jest.mock('../../../models/library/set-ebook');

const mockSetEbook = setEbookModel.setEbook as jest.Mock;

function makeReq(bookId: string) {
  return { user: { id: 7 }, params: { bookId } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const entry = { user_id: 7, book_id: 12, is_favorite: false, is_hidden: false, is_ebook: true };

beforeEach(() => {
  mockSetEbook.mockResolvedValue(entry);
});

describe('set-ebook controller', () => {
  it('PUT marks the book as an ebook', async () => {
    const res = makeRes();
    await markEbook(makeReq('12'), res);

    expect(mockSetEbook).toHaveBeenCalledWith(7, 12, true);
    expect(res.json).toHaveBeenCalledWith({ entry });
  });

  it('DELETE returns it to a physical copy', async () => {
    mockSetEbook.mockResolvedValue({ ...entry, is_ebook: false });

    const res = makeRes();
    await markPhysical(makeReq('12'), res);

    expect(mockSetEbook).toHaveBeenCalledWith(7, 12, false);
    expect(res.json).toHaveBeenCalledWith({
      entry: { ...entry, is_ebook: false },
    });
  });

  it('returns 404 when the reader does not own the book', async () => {
    mockSetEbook.mockResolvedValue(null);

    const res = makeRes();
    await markEbook(makeReq('12'), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for a non-numeric book id', async () => {
    const res = makeRes();
    await markEbook(makeReq('bulk'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSetEbook).not.toHaveBeenCalled();
  });
});
