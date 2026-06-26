import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authRequired, authOptional } from '../../middleware/auth';

jest.mock('jsonwebtoken');

const mockVerify = jwt.verify as jest.Mock;

function makeReq(authHeader?: string) {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const next = jest.fn() as unknown as NextFunction;

describe('authRequired', () => {
  it('sets req.user and calls next when token is valid', () => {
    mockVerify.mockReturnValue({ id: 1, email: 'a@b.com' });
    const req = makeReq('Bearer validtoken');
    const res = makeRes();
    authRequired(req, res, next);
    expect(req.user).toEqual({ id: 1, email: 'a@b.com' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when no authorization header', () => {
    const req = makeReq();
    const res = makeRes();
    authRequired(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', () => {
    const req = makeReq('Basic abc');
    const res = makeRes();
    authRequired(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when jwt.verify throws', () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid token'); });
    const req = makeReq('Bearer badtoken');
    const res = makeRes();
    authRequired(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authOptional', () => {
  it('sets req.user and calls next when token is valid', () => {
    mockVerify.mockReturnValue({ id: 2, email: 'b@c.com' });
    const req = makeReq('Bearer token');
    const res = makeRes();
    authOptional(req, res, next);
    expect(req.user).toEqual({ id: 2, email: 'b@c.com' });
    expect(next).toHaveBeenCalled();
  });

  it('sets req.user to null and calls next when no header', () => {
    const req = makeReq();
    const res = makeRes();
    authOptional(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('sets req.user to null when token is invalid', () => {
    mockVerify.mockImplementation(() => { throw new Error('bad'); });
    const req = makeReq('Bearer bad');
    const res = makeRes();
    authOptional(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});
