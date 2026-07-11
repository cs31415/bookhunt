import { Request, Response } from 'express';
import { addExistingToLibrary } from '../../../controllers/library/add-existing-to-library';
import * as addExistingToLibraryModel from '../../../models/library/add-existing-to-library';

jest.mock('../../../models/library/add-existing-to-library');

const mockAddExistingToLibrary = addExistingToLibraryModel.addExistingToLibrary as jest.Mock;

function makeReq(bookId: string, body: Record<string, unknown> = {}, userId = 7) {
  return {
    params: { bookId },
    body,
    user: { id: userId, email: 'a@b.com' },
  } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('addExistingToLibrary controller', () => {
  it('defaults status to queued and returns the entry', async () => {
    const entry = { user_id: 7, book_id: 5, status: 'queued' };
    mockAddExistingToLibrary.mockResolvedValue(entry);
    const res = makeRes();

    await addExistingToLibrary(makeReq('5'), res);

    expect(mockAddExistingToLibrary).toHaveBeenCalledWith(7, 5, 'queued');
    expect(res.json).toHaveBeenCalledWith({ entry });
  });

  it('passes through an explicit valid status', async () => {
    mockAddExistingToLibrary.mockResolvedValue({});
    const res = makeRes();

    await addExistingToLibrary(makeReq('5', { status: 'reading' }), res);

    expect(mockAddExistingToLibrary).toHaveBeenCalledWith(7, 5, 'reading');
  });

  it('returns 400 for a non-numeric bookId', async () => {
    const res = makeRes();

    await addExistingToLibrary(makeReq('abc'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockAddExistingToLibrary).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid status', async () => {
    const res = makeRes();

    await addExistingToLibrary(makeReq('5', { status: 'bogus' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockAddExistingToLibrary).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockAddExistingToLibrary.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await addExistingToLibrary(makeReq('5'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
