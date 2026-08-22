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

/**
 * An unlisted share token is a bearer credential (LOS-305), and it travels in
 * the path rather than the body -- so SENSITIVE_FIELDS above never sees it and
 * the whole token would otherwise sit in the container log.
 *
 * The BFF strips it too, but that is not enough on its own: every browser
 * request is forwarded here, and api.bookhunt.net is a direct surface besides.
 * Both loggers have to do it (LOS-307).
 *
 * Only the secret goes. The route stays readable, so the line still says which
 * endpoint was called and anything after the token is kept.
 */
function redactUrl(url: string): string {
  return url.replace(/(\/users\/by-token\/)[^/?]+/, (_match, prefix: string) => `${prefix}${REDACTED}`);
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.method === 'OPTIONS' || req.path === '/api/health') return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    let line = `${req.method} ${redactUrl(req.originalUrl)} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      line += ` body=${JSON.stringify(redactBody(req.body))}`;
    }
    console.log(line);
  });

  next();
}
