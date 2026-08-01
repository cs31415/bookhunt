/**
 * Categorize catalog books that carry no AI tags yet.
 *
 * Tagging used to happen one book at a time, lazily, so most of the catalog was
 * never tagged at all -- 33 of 331 books in the library -- and the tags that did
 * exist described each book in isolation rather than grouping it with others.
 * This walks the untagged books through the batched categorizer.
 *
 * Batched and sequential on purpose, for two different reasons. Batched,
 * because the model can only group books it can see together. Sequential,
 * because categorizeBooks re-reads the vocabulary per call, so each batch feeds
 * the next one's prompt -- run in parallel, every batch would see the same
 * stale vocabulary and converge on nothing.
 *
 * Usage:
 *   npx tsx scripts/backfill-book-tags.ts --list        # no LLM calls; show what would run
 *   npx tsx scripts/backfill-book-tags.ts --limit 40    # try a few before spending on all
 *   npx tsx scripts/backfill-book-tags.ts --all         # include books that already have tags
 *   npx tsx scripts/backfill-book-tags.ts
 */
import dotenv from 'dotenv';
import path from 'path';
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local'), override: true, quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });

import { pool } from '../src/lib/db';
import { getTagVocabulary } from '../src/data/ai-data';
import { categorizeBooks, BookToCategorize } from '../src/models/ai/categorize-books';

// Matches the import client's default rowsPerRequest, so the backfill exercises
// the same batch size production will.
const BATCH_SIZE = 20;

function parseNumberFlag(argv: string[], flag: string): number | null {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  const value = parseInt(argv[index + 1] ?? '', 10);
  if (Number.isNaN(value) || value < 1) {
    console.error(`${flag} needs a positive integer`);
    process.exit(1);
  }
  return value;
}

async function booksToTag(limit: number | null, all: boolean): Promise<BookToCategorize[]> {
  const result = await pool.query(
    `SELECT b.id, b.title, a.name AS author_name
     FROM books b JOIN authors a ON a.id = b.author_id
     ${all ? '' : 'WHERE COALESCE(array_length(b.themes, 1), 0) = 0 OR COALESCE(array_length(b.moods, 1), 0) = 0'}
     ORDER BY b.id
     ${limit ? 'LIMIT $1' : ''}`,
    limit ? [limit] : [],
  );
  return result.rows.map((row) => ({ id: row.id, title: row.title, authorName: row.author_name }));
}

async function reportDistribution(label: string) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS distinct_tags,
            COUNT(*) FILTER (WHERE cnt > 1)::int AS on_multiple_books,
            COALESCE(MAX(cnt), 0)::int AS most_shared
     FROM (
       SELECT s, COUNT(*) AS cnt
       FROM books b, unnest(b.subjects) AS s
       GROUP BY s
     ) t`,
  );
  const { distinct_tags, on_multiple_books, most_shared } = result.rows[0];
  console.log(
    `${label}: ${distinct_tags} distinct subjects, ${on_multiple_books} on more than one book, ` +
      `most-shared covers ${most_shared}`,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const limit = parseNumberFlag(argv, '--limit');
  const listOnly = argv.includes('--list');
  const all = argv.includes('--all');

  const books = await booksToTag(limit, all);
  await reportDistribution('Before');

  if (listOnly) {
    const vocabulary = await getTagVocabulary('subjects', 150);
    console.log(`\nCurrent category vocabulary (${vocabulary.length}): ${vocabulary.join(', ')}`);
    console.log(`\n${books.length} books would be categorized:`);
    for (const book of books) console.log(`  ${book.id}  ${book.title}`);
    return;
  }

  const batchCount = Math.ceil(books.length / BATCH_SIZE);
  console.log(`\nCategorizing ${books.length} books in ${batchCount} batches of up to ${BATCH_SIZE}...\n`);

  let tagged = 0;
  let skipped = 0;
  for (let offset = 0; offset < books.length; offset += BATCH_SIZE) {
    const batch = books.slice(offset, offset + BATCH_SIZE);
    const position = `[batch ${Math.floor(offset / BATCH_SIZE) + 1}/${batchCount}]`;
    try {
      const results = await categorizeBooks(batch);
      tagged += results.length;
      // A book the model omitted is left untagged rather than guessed at; a
      // re-run picks it up.
      skipped += batch.length - results.length;
      console.log(`${position} tagged ${results.length}/${batch.length}`);
      for (const result of results) {
        const book = batch.find((b) => b.id === result.id);
        console.log(`  ${book?.title}`);
        console.log(`    categories: ${result.categories.join(' | ')}`);
        console.log(`    themes:     ${result.themes.join(' | ')}`);
      }
    } catch (error) {
      // One batch failing should not cost the run; the vocabulary built so far
      // still stands and a re-run picks these books up again.
      skipped += batch.length;
      console.error(`${position} failed: ${(error as Error).message}`);
    }
  }

  console.log('');
  await reportDistribution('After');
  console.log(`${tagged} books tagged, ${skipped} left for a re-run.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
