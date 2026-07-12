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
  (res as any).json = jest.fn().mockReturnValue(res);
  (res as any).send = jest.fn().mockReturnValue(res);
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

  it('logs the response body passed to res.json', () => {
    const req = makeReq('GET', '/api/books/42');
    const res = makeRes(200);
    requestLogger(req, res, next);

    res.json({ id: 42, title: 'Dune' });
    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('response={"id":42,"title":"Dune"}');
  });

  it('logs an array response body from res.json without mangling it', () => {
    const req = makeReq('GET', '/api/books');
    const res = makeRes(200);
    requestLogger(req, res, next);

    res.json([{ id: 1 }, { id: 2 }]);
    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('response=[{"id":1},{"id":2}]');
  });

  it('logs the response body passed to res.send when res.json is not used', () => {
    const req = makeReq('GET', '/health');
    const res = makeRes(200);
    requestLogger(req, res, next);

    res.send('OK');
    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('response="OK"');
  });

  it('redacts sensitive fields in the logged response body', () => {
    const req = makeReq('POST', '/api/auth/login', { username: 'alice', password: 'hunter2' });
    const res = makeRes(200);
    requestLogger(req, res, next);

    res.json({ token: 'abc123', user: 'alice' });
    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).toContain('"token":"[REDACTED]"');
    expect(line).not.toContain('abc123');
  });

  it('does not append a response suffix when no body was sent', () => {
    const req = makeReq('DELETE', '/api/library/7');
    const res = makeRes(204);
    requestLogger(req, res, next);

    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).not.toContain('response=');
  });

  it('does not append a response suffix for an empty object body', () => {
    const req = makeReq('GET', '/api/books/999');
    const res = makeRes(200);
    requestLogger(req, res, next);

    res.json({});
    (res as unknown as EventEmitter).emit('finish');

    const [line] = logSpy.mock.calls[0];
    expect(line).not.toContain('response=');
  });
});
