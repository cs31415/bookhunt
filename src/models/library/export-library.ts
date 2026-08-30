import { exportLibraryRows } from '../../data/library-data';
import type { ExportLibraryRow } from '../../data/library-data';
import { myFavoriteAuthors } from '../authors/favorites';
import { myFavorites } from '../users/favorites';

/**
 * Rows per round trip while walking the library. Big enough that a few hundred
 * books is one or two queries, small enough that nothing has to hold an
 * unbounded result set.
 */
const PAGE_SIZE = 500;

/**
 * A ceiling on the walk, so a bug in the paging cannot loop forever. Well above
 * any real library; a reader who passes it gets a truncated file rather than a
 * hung request, which is the better of the two failures.
 */
const MAX_BOOKS = 50_000;

export interface ExportedBook {
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  /**
   * The stored word -- queued, reading, finished, abandoned -- not the label
   * the CSV importer shows. A machine-readable file carries the
   * machine-readable word.
   */
  status: string;
  /**
   * One word rather than the two booleans the shelf stores, because that is
   * what the CSV importer reads back (LOS-347). 'physical' is the absence of
   * the other two, which is how the importer treats a missing format as well.
   */
  format: 'ebook' | 'audiobook' | 'physical';
}

export interface LibraryExport {
  exportedAt: string;
  books: ExportedBook[];
  favorites: {
    books: ExportedBook[];
    authors: { name: string; slug: string }[];
    users: { handle: string; displayName: string }[];
  };
}

/**
 * Fields deliberately a superset of what the CSV importer reads, so a library
 * can go out as JSON, through a spreadsheet, and back in again.
 */
function toBook(row: ExportLibraryRow): ExportedBook {
  return {
    title: row.title,
    author: row.author_name,
    publisher: row.publisher,
    isbn: row.isbn13,
    status: row.status,
    // Ebook wins a row claiming both. The flags are independent in the schema
    // but the importer's column is one word, and a reader who set both is
    // likelier to be reading than listening.
    format: row.is_ebook ? 'ebook' : row.is_audiobook ? 'audiobook' : 'physical',
  };
}

/** Walks every page rather than trusting one call to hold the whole library. */
async function allRows(userId: number): Promise<ExportLibraryRow[]> {
  const rows: ExportLibraryRow[] = [];
  let offset = 0;

  for (;;) {
    const page = await exportLibraryRows(userId, { limit: PAGE_SIZE, offset });
    rows.push(...page);

    // A short page is the last one. The window total is the other stop, and
    // both are checked because either alone leaves a way to loop.
    if (page.length < PAGE_SIZE) break;
    if (rows.length >= Number(page[0].total_count)) break;
    if (rows.length >= MAX_BOOKS) break;

    offset += PAGE_SIZE;
  }

  return rows;
}

/**
 * Everything a reader would want if they were leaving: the shelf, and the three
 * favourite lists the app keeps separately.
 *
 * Favourite books are filtered from the rows already fetched rather than asked
 * for again -- the flag is on the row, so a second query would ask the same
 * question twice.
 */
export async function exportLibrary(userId: number): Promise<LibraryExport> {
  const [rows, authors, users] = await Promise.all([
    allRows(userId),
    myFavoriteAuthors(userId),
    myFavorites(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    books: rows.map(toBook),
    favorites: {
      books: rows.filter((row) => row.is_favorite).map(toBook),
      authors: authors.map(({ name, slug }) => ({ name, slug })),
      users: users.map(({ handle, displayName }) => ({ handle, displayName })),
    },
  };
}
