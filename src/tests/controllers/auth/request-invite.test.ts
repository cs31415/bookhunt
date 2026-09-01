import { Request, Response } from 'express';
import { requestInvite } from '../../../controllers/auth/request-invite';
import * as model from '../../../models/auth/request-invite';

jest.mock('../../../models/auth/request-invite', () => ({
  ...jest.requireActual('../../../models/auth/request-invite'),
  requestInvite: jest.fn(),
}));

const mockRecord = model.requestInvite as jest.Mock;

function makeReq(body: unknown = {}) {
  return { body } as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

beforeEach(() => {
  mockRecord.mockReset();
  mockRecord.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('request-invite controller', () => {
  it('records the request', async () => {
    const res = makeRes();
    await requestInvite(makeReq({ email: 'sam@example.com', note: 'I read a lot' }), res);

    expect(mockRecord).toHaveBeenCalledWith('sam@example.com', 'I read a lot');
    expect(res.status).toHaveBeenCalledWith(202);
  });

  /*
   * The property the whole design rests on (LOS-381). A public form that mailed
   * an invite would rebuild the vector LOS-376 closed, with a working
   * credential in the message. Nothing here sends anything, so the assertion is
   * that the model -- which only writes a row -- is the entire effect.
   */
  it('records without sending anything', async () => {
    await requestInvite(makeReq({ email: 'sam@example.com' }), makeRes());

    expect(mockRecord).toHaveBeenCalledTimes(1);
  });

  it('accepts a request with no note', async () => {
    const res = makeRes();
    await requestInvite(makeReq({ email: 'sam@example.com' }), res);

    expect(mockRecord).toHaveBeenCalledWith('sam@example.com', null);
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('refuses an address that is not one', async () => {
    const res = makeRes();
    await requestInvite(makeReq({ email: 'not-an-address' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('refuses a note longer than the cap', async () => {
    const res = makeRes();
    await requestInvite(makeReq({ email: 'sam@example.com', note: 'x'.repeat(501) }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('refuses a note that is not text', async () => {
    const res = makeRes();
    await requestInvite(makeReq({ email: 'sam@example.com', note: { $ne: null } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  describe('the honeypot', () => {
    // Hidden from people and left empty by them. A bot filling in every field
    // trips it.
    it('discards a submission that filled the hidden field', async () => {
      const res = makeRes();
      await requestInvite(
        makeReq({ email: 'bot@example.com', website: 'http://spam.example' }),
        res,
      );

      expect(mockRecord).not.toHaveBeenCalled();
      // Answered exactly as a success is: a bot that learns which submissions
      // were dropped is a bot that stops filling the field in.
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('ignores the field when it is empty, as a person leaves it', async () => {
      await requestInvite(makeReq({ email: 'sam@example.com', website: '   ' }), makeRes());

      expect(mockRecord).toHaveBeenCalled();
    });
  });

  /*
   * No enumeration. The endpoint answers the same whether the address has an
   * account, whether the write succeeded, and whether the database is even up
   * -- otherwise a closed door becomes a directory of who is behind it.
   */
  describe('says the same thing whatever happens', () => {
    it('answers 202 when the write fails', async () => {
      mockRecord.mockRejectedValue(new Error('database down'));

      const res = makeRes();
      await requestInvite(makeReq({ email: 'sam@example.com' }), res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('logs the failure for whoever can act on it', async () => {
      mockRecord.mockRejectedValue(new Error('database down'));

      await requestInvite(makeReq({ email: 'sam@example.com' }), makeRes());

      expect(console.error).toHaveBeenCalled();
    });

    it('gives the same reply to a fresh address and a repeat', async () => {
      const first = makeRes();
      await requestInvite(makeReq({ email: 'sam@example.com' }), first);
      const second = makeRes();
      await requestInvite(makeReq({ email: 'sam@example.com' }), second);

      expect(first.status).toHaveBeenCalledWith(202);
      expect(second.status).toHaveBeenCalledWith(202);
    });
  });
});
