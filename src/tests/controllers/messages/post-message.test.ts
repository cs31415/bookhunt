import { Request, Response } from 'express';
import { postMessage } from '../../../controllers/messages/messages';
import * as model from '../../../models/messages/messages';

jest.mock('../../../models/messages/messages', () => ({
  ...jest.requireActual('../../../models/messages/messages'),
  send: jest.fn(),
}));

const mockSend = model.send as jest.Mock;

function makeReq(body: unknown) {
  return { user: { id: 1 }, params: { handle: 'bob' }, body } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('postMessage controller', () => {
  it('returns 201 with the stored message', async () => {
    mockSend.mockResolvedValue({
      ok: true,
      message: { id: 5, body: 'hi', createdAt: 'now', fromMe: true },
    });

    const res = makeRes();
    await postMessage(makeReq({ body: 'hi' }), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('answers 403 with a code when the pair is not mutual', async () => {
    // The reader can act on this: favourite them back, or ask them to.
    mockSend.mockResolvedValue({ ok: false, reason: 'not-mutual' });

    const res = makeRes();
    await postMessage(makeReq({ body: 'hi' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_MUTUAL_FAVORITE' }),
    );
  });

  it('answers 422 with a different code when the filter refused it', async () => {
    // A different action entirely: edit the words. Collapsing this into the
    // 403 would tell the reader to befriend someone they already have.
    mockSend.mockResolvedValue({ ok: false, reason: 'rejected' });

    const res = makeRes();
    await postMessage(makeReq({ body: 'kys' }), res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MESSAGE_REJECTED' }),
    );
  });

  it.each([
    ['an empty body', 'empty'],
    ['an over-long body', 'too-long'],
  ])('answers 400 for %s', async (_label, reason) => {
    mockSend.mockResolvedValue({ ok: false, reason });

    const res = makeRes();
    await postMessage(makeReq({ body: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
