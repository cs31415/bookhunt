import { Request, Response, NextFunction } from 'express';

const REDACTED = '[REDACTED]';
const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'currentPassword', 'token']);

function redactBody(body: unknown): unknown {
  if (Buffer.isBuffer(body)) return `[Buffer ${body.length} bytes]`;
  if (Array.isArray(body)) return body.map(redactBody);
  if (typeof body !== 'object' || body === null) return body;
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      SENSITIVE_FIELDS.has(key) ? REDACTED : value,
    ])
  );
}

function hasContent(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  if (!Buffer.isBuffer(body) && !Array.isArray(body) && typeof body === 'object') {
    return Object.keys(body).length > 0;
  }
  return true;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  let responseBody: unknown;
  let responseBodyCaptured = false;

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    responseBody = body;
    responseBodyCaptured = true;
    return originalJson(body);
  }) as Response['json'];

  const originalSend = res.send.bind(res);
  res.send = ((body: unknown) => {
    if (!responseBodyCaptured) {
      responseBody = body;
      responseBodyCaptured = true;
    }
    return originalSend(body);
  }) as Response['send'];

  res.on('finish', () => {
    if (req.method === 'OPTIONS' || req.path === '/api/health') return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    let line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      line += ` body=${JSON.stringify(redactBody(req.body))}`;
    }
    if (hasContent(responseBody)) {
      line += ` response=${JSON.stringify(redactBody(responseBody))}`;
    }
    console.log(line);
  });

  next();
}
