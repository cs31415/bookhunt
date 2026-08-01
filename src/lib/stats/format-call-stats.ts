import { BooksProvider } from '../books/books-types';
import { CallStats } from './call-stats-store';

/**
 * Listed explicitly rather than derived from what was called, so a run that
 * touched neither provider still reports `google_books=0 open_library=0` and
 * the line stays greppable and diffable across requests.
 */
const PROVIDERS: BooksProvider[] = ['google_books', 'open_library'];

/**
 * One line summarising what a request spent externally, e.g.
 *
 *   [import] rows=40 google_books=37 open_library=4 db=40 calls, 183 rows [5,5,0,3,…]
 *
 * The per-call row counts are kept rather than only their total: in the import
 * path every query is a catalog book search, so a zero is a row the catalog had
 * nothing for and a provider therefore had to answer. They are in completion
 * order, not request order — the queries run concurrently — so the list says how
 * many rows missed locally, not which ones.
 */
export function formatCallStats(label: string, stats: CallStats, rowCount?: number): string {
  const providers = PROVIDERS.map((p) => `${p}=${stats.providerCalls.get(p) ?? 0}`).join(' ');
  const dbRows = stats.dbRowCounts.reduce((sum, n) => sum + n, 0);

  return (
    `[${label}]` +
    (rowCount === undefined ? '' : ` rows=${rowCount}`) +
    ` ${providers}` +
    ` db=${stats.dbRowCounts.length} calls, ${dbRows} rows [${stats.dbRowCounts.join(',')}]`
  );
}
