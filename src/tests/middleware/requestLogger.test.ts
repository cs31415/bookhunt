import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../../middleware/requestLogger';

function makeReq(method: string, originalUrl: string) {
  return { method, originalUrl } as unknown as Request;
}

function makeRes(statusCode: number) {
  const res = new EventEmitter() as unknown as Response;
  (res as any).statusCode = statusCode;
  return res;
}

const next = jest.fn() as unknown as NextFunction;

describe('requestLogger', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('calls next immediately', () => {
    const req = makeReq('GET', '/api/books');
    const res = makeRes(200);
    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('logs method, path, status, and duration once the response finishes', () => {
    const req = makeReq('GET', '/api/books/42');
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [line] = logSpy.mock.calls[0];
    expect(line).toMatch(/^GET \/api\/books\/42 200 \d+(\.\d+)?ms$/);
  });

  it('logs the actual status code set on the response', () => {
    const req = makeReq('POST', '/api/auth/register');
    const res = makeRes(201);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('POST /api/auth/register 201');
  });

  it('does not log before the response finishes', () => {
    const req = makeReq('GET', '/api/books');
    const res = makeRes(200);
    requestLogger(req, res, next);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
