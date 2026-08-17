import { Request, Response } from 'express';
import { markAudiobook, clearAudiobook } from '../../../controllers/library/set-audiobook';
import * as setAudiobookModel from '../../../models/library/set-audiobook';

jest.mock('../../../models/library/set-audiobook');

const mockSetAudiobook = setAudiobookModel.setAudiobook as jest.Mock;

function makeReq(bookId: string) {
  return { user: { id: 7 }, params: { bookId } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const entry = {
  user_id: 7,
  book_id: 12,
  is_favorite: false,
  is_hidden: false,
  is_ebook: false,
  is_audiobook: true,
};

beforeEach(() => {
  mockSetAudiobook.mockResolvedValue(entry);
});

describe('set-audiobook controller', () => {
  it('PUT marks the book as an audiobook', async () => {
    const res = makeRes();
    await markAudiobook(makeReq('12'), res);

    expect(mockSetAudiobook).toHaveBeenCalledWith(7, 12, true);
    expect(res.json).toHaveBeenCalledWith({ entry });
  });

  it('DELETE clears the flag', async () => {
    mockSetAudiobook.mockResolvedValue({ ...entry, is_audiobook: false });

    const res = makeRes();
    await clearAudiobook(makeReq('12'), res);

    expect(mockSetAudiobook).toHaveBeenCalledWith(7, 12, false);
    expect(res.json).toHaveBeenCalledWith({
      entry: { ...entry, is_audiobook: false },
    });
  });

  // The two flags are independent: a reader can own the Kindle and the Audible
  // copy of the same book, so this endpoint never touches is_ebook.
  it('leaves the ebook flag as the row had it', async () => {
    mockSetAudiobook.mockResolvedValue({ ...entry, is_ebook: true });

    const res = makeRes();
    await markAudiobook(makeReq('12'), res);

    expect(res.json).toHaveBeenCalledWith({
      entry: expect.objectContaining({ is_ebook: true, is_audiobook: true }),
    });
  });

  it('returns 404 when the reader does not own the book', async () => {
    mockSetAudiobook.mockResolvedValue(null);

    const res = makeRes();
    await markAudiobook(makeReq('12'), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for a non-numeric book id', async () => {
    const res = makeRes();
    await markAudiobook(makeReq('bulk'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSetAudiobook).not.toHaveBeenCalled();
  });
});
