/**
 * Query parameters whose value is a credential. `key` is the one that actually
 * bites today — Google Books takes its API key that way, so every provider URL
 * we log carries it — but the rest cost nothing to cover and mean a future
 * provider authenticating differently is redacted before anyone notices it
 * wasn't.
 */
const SECRET_PARAMS = ['key', 'api_key', 'apikey', 'access_token', 'token', 'secret', 'password'];

const SECRET_PATTERN = new RegExp(`([?&])(${SECRET_PARAMS.join('|')})=[^&#]*`, 'gi');

/**
 * Masks credential-bearing query parameters in a URL so it is safe to log.
 *
 * Rewriting the string rather than round-tripping through `URL` is deliberate:
 * `searchParams.set()` re-encodes the entire query, and these log lines exist to
 * be copy-pasted back at a provider when a lookup returns the wrong book. A
 * query that came back re-escaped is a different query to debug (see LOS-199,
 * where exact `intitle:` punctuation decided the result set). This leaves every
 * other byte alone, and degrades safely on a malformed URL that `URL` would
 * throw on.
 */
export function redactUrlSecrets(url: string): string {
  return url.replace(SECRET_PATTERN, '$1$2=[redacted]');
}
