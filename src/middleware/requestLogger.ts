import { Request, Response, NextFunction } from 'express';

const REDACTED = '[REDACTED]';
const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'currentPassword', 'token']);

function redactBody(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return body;
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      SENSITIVE_FIELDS.has(key) ? REDACTED : value,
    ])
  );
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.method === 'OPTIONS' || req.path === '/api/health') return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    let line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      line += ` body=${JSON.stringify(redactBody(req.body))}`;
    }
    console.log(line);
  });

  next();
}
