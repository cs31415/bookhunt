/**
 * Builds an absolute link into the web app. Read lazily rather than as a
 * module-level const so dotenv has run by the time it is called, and trimmed of
 * a trailing slash because FRONTEND_URL is written both ways in practice and
 * `https://host//verify-email` is not the same URL to every router.
 */
export function frontendUrl(path: string): string {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
