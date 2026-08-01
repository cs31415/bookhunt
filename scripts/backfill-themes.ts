/**
 * Re-tag books that already carry themes, so their themes converge on a shared
 * vocabulary instead of each book having its own phrasing.
 *
 * Books tagged before LOS-191 were generated with no vocabulary in the prompt,
 * so almost no two share a theme and the library's theme filter has nothing to
 * group by. This walks them through the new pipeline.
 *
 * Sequential on purpose, and generateThemes re-reads the vocabulary per book:
 * each book's themes feed the next book's prompt, which is the whole mechanism.
 * Run in parallel, every book would see the same stale vocabulary and converge
 * on nothing.
 *
 * Usage:
 *   npx tsx scripts/backfill-themes.ts --list        # no LLM calls; show what would run
 *   npx tsx scripts/backfill-themes.ts --limit 5     # try a few before spending on all
 *   npx tsx scripts/backfill-themes.ts
 */
import dotenv from 'dotenv';
import path from 'path';
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local'), override: true, quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });

import { pool } from '../src/lib/db';
import { getThemeVocabulary } from '../src/data/ai-data';
import { generateThemes } from '../src/models/ai/generate-themes';

interface BookRow {
  id: number;
  title: string;
  themes: string[];
}

function parseLimit(argv: string[]): number | null {
  const index = argv.indexOf('--limit');
  if (index === -1) return null;
  const value = parseInt(argv[index + 1] ?? '', 10);
  if (Number.isNaN(value) || value < 1) {
    console.error('--limit needs a positive integer');
    process.exit(1);
  }
  return value;
}

// Oldest first, so the earliest-tagged books seed the vocabulary the rest see.
async function booksToBackfill(limit: number | null): Promise<BookRow[]> {
  const result = await pool.query(
    `SELECT id, title, themes
     FROM books
     WHERE array_length(themes, 1) > 0
     ORDER BY id
     ${limit ? 'LIMIT $1' : ''}`,
    limit ? [limit] : [],
  );
  return result.rows;
}

async function reportDistribution(label: string) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS distinct_themes,
            COUNT(*) FILTER (WHERE cnt > 1)::int AS multi_book_themes,
            COALESCE(MAX(cnt), 0)::int AS max_books_per_theme
     FROM (
       SELECT th, COUNT(*) AS cnt
       FROM books b, unnest(b.themes) AS th
       GROUP BY th
     ) t`,
  );
  const { distinct_themes, multi_book_themes, max_books_per_theme } = result.rows[0];
  console.log(
    `${label}: ${distinct_themes} distinct themes, ${multi_book_themes} on more than one book, ` +
      `most-shared theme covers ${max_books_per_theme}`,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const listOnly = argv.includes('--list');

  const books = await booksToBackfill(limit);
  await reportDistribution('Before');

  if (listOnly) {
    const vocabulary = await getThemeVocabulary(150);
    console.log(`\nCurrent vocabulary (${vocabulary.length}): ${vocabulary.join(', ')}`);
    console.log(`\n${books.length} books would be re-tagged:`);
    for (const book of books) console.log(`  ${book.id}  ${book.title}`);
    return;
  }

  console.log(`\nRe-tagging ${books.length} books (one LLM call each)...\n`);

  let failed = 0;
  for (const [index, book] of books.entries()) {
    const position = `[${index + 1}/${books.length}]`;
    try {
      const result = await generateThemes(book.id, { force: true });
      if (!result) {
        console.warn(`${position} ${book.id} ${book.title}: book vanished, skipped`);
        failed += 1;
        continue;
      }
      console.log(`${position} ${book.title}`);
      console.log(`         was: ${book.themes.join(' | ')}`);
      console.log(`         now: ${result.themes.join(' | ')}`);
    } catch (error) {
      // One book's failure should not cost the run; the vocabulary built so far
      // still stands and a re-run picks the book up again.
      failed += 1;
      console.error(`${position} ${book.id} ${book.title}: ${(error as Error).message}`);
    }
  }

  console.log('');
  await reportDistribution('After');
  if (failed > 0) console.log(`${failed} book(s) failed; re-run to retry them.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
