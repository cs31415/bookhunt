import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../../middleware/requestLogger';

function makeReq(method: string, originalUrl: string, body?: unknown) {
  const path = originalUrl.split('?')[0];
  return { method, originalUrl, path, body } as unknown as Request;
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

  // A share token is a bearer credential and travels in the path, where
  // SENSITIVE_FIELDS never sees it. The BFF strips it too, but every browser
  // request is forwarded here and api.bookhunt.net is a direct surface
  // besides, so both loggers have to do it (LOS-307).
  it('never logs an unlisted share token', () => {
    const req = makeReq('GET', '/api/users/by-token/9f8e7d6c-secret-token');
    const res = makeRes(404);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).not.toContain('9f8e7d6c-secret-token');
    expect(line).toContain('/api/users/by-token/[REDACTED]');
  });

  it('keeps the rest of the route when it strips the token', () => {
    const req = makeReq('GET', '/api/users/by-token/9f8e7d6c-secret-token/library?tab=reading');
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).not.toContain('9f8e7d6c-secret-token');
    expect(line).toContain('/api/users/by-token/[REDACTED]/library?tab=reading');
  });

  it('leaves every other path alone', () => {
    const req = makeReq('GET', '/api/users/ada/library');
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('/api/users/ada/library');
    expect(line).not.toContain('[REDACTED]');
  });

  it('logs the actual status code set on the response', () => {
    const req = makeReq('POST', '/api/auth/register');
    const res = makeRes(201);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('POST /api/auth/register 201');
  });

  it('does not log OPTIONS requests', () => {
    const req = makeReq('OPTIONS', '/api/books');
    const res = makeRes(204);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not log health check calls', () => {
    const req = makeReq('GET', '/api/health');
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not log before the response finishes', () => {
    const req = makeReq('GET', '/api/books');
    const res = makeRes(200);
    requestLogger(req, res, next);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs the body for POST requests', () => {
    const req = makeReq('POST', '/api/library/bulk', { bookIds: ['a', 'b'] });
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('body={"bookIds":["a","b"]}');
  });

  it('redacts sensitive fields like password and token in the logged body', () => {
    const req = makeReq('POST', '/api/auth/reset-password', {
      token: 'abc123',
      password: 'hunter2',
    });
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('"token":"[REDACTED]"');
    expect(line).toContain('"password":"[REDACTED]"');
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('abc123');
  });

  it('does not append a body suffix for POST requests with an empty body', () => {
    const req = makeReq('POST', '/api/library/bulk', {});
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).not.toContain('body=');
  });

  it('does not log a body for non-POST requests', () => {
    const req = makeReq('GET', '/api/books', { foo: 'bar' });
    const res = makeRes(200);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).not.toContain('body=');
  });
});
