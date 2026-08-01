/**
 * The summary shape every catalog book is served in: what a cover, a title line
 * and a link need, and nothing more.
 *
 * `rating` stays as the driver returns it — NUMERIC arrives as a string — because
 * that is what clients already receive from GET /books and normalise on arrival.
 */
export interface CatalogBookSummary {
  id: number;
  slug: string;
  title: string;
  authorName: string;
  authorSlug: string;
  year: number | null;
  rating: number | string | null;
  coverUrl: string | null;
  hue: string;
  googleBooksId?: string | null;
}

/**
 * Maps a catalog row to that shape. Written against the columns fn_get_books_by_ids
 * and fn_search_books have in common, so a row from either serves — which is what
 * lets the import resolver hand back the book it already matched instead of
 * sending the client to GET /books for it.
 */
export function formatCatalogBook(row: any): CatalogBookSummary {
  return {
    id: Number(row.book_id),
    slug: row.slug,
    title: row.title,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    year: row.year,
    rating: row.rating,
    coverUrl: row.cover_url,
    hue: row.hue,
    ...(row.google_books_id !== undefined ? { googleBooksId: row.google_books_id } : {}),
  };
}
