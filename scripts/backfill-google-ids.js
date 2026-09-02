/**
 * Give a Google volume to the rows that only ever had an Open Library one
 * (LOS-389).
 *
 *   node scripts/backfill-google-ids.js              -- dry run, writes nothing
 *   node scripts/backfill-google-ids.js --write      -- applies it
 *   node scripts/backfill-google-ids.js --limit 10   -- try a few first
 *
 * Dry run is the default on purpose. This rewrites provider fields on rows that
 * are in somebody's library, and the failure mode is a plausible-looking wrong
 * book, which nobody notices.
 *
 * CommonJS, because there is no tsx on the droplet. Run it through the api
 * container, where /app/scripts is mounted and dist/ holds the scorer.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { Pool } = require('pg');

/*
 * The same scorer the import uses, required from dist rather than reimplemented
 * (/app/dist in the container). Reimplementing it here would let the two drift,
 * and this job's whole safety argument rests on scoring exactly as import does
 * -- an ISBN match is worth +10 there, which is why an ISBN cannot be outvoted.
 */
const { scoreCandidate } = require(path.join(ROOT, 'dist/models/matching/match-book-candidate'));

const API = 'https://www.googleapis.com/books/v1/volumes';
/** Google's free tier is 1,000/day and this is ~116 calls; the pause is politeness. */
const PAUSE_MS = 700;
/** Below this, a title match is too weak to rewrite somebody's row on. */
const MIN_SCORE = 1.0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function quoted(value) {
  return `"${String(value).replace(/"/g, '')}"`;
}

async function search(query, key) {
  const url = `${API}?q=${encodeURIComponent(query)}&maxResults=5&key=${key}`;
  const res = await fetch(url);
  const body = await res.json();
  if (body.error) throw new Error(`google ${body.error.code}: ${body.error.message.slice(0, 60)}`);
  return (body.items || []).map((item) => {
    const v = item.volumeInfo || {};
    const ids = v.industryIdentifiers || [];
    const isbn13 = (ids.find((i) => i.type === 'ISBN_13') || {}).identifier || null;
    return {
      googleBooksId: item.id,
      title: v.title || '',
      authors: v.authors || [],
      publishers: v.publisher ? [v.publisher] : [],
      publisher: v.publisher || null,
      isbn13,
      pages: v.pageCount ?? null,
      rating: v.averageRating ?? null,
      language: v.language || null,
      year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) || null : null,
      description: v.description || null,
      coverUrl: (v.imageLinks || {}).thumbnail || null,
    };
  });
}

async function main() {
  const write = process.argv.includes('--write');
  const limitIndex = process.argv.indexOf('--limit');
  const limit = limitIndex === -1 ? null : parseInt(process.argv[limitIndex + 1], 10) || null;

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) {
    console.error('GOOGLE_BOOKS_API_KEY is not set; refusing to run unauthenticated.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // google_books_id IS NULL, not source: 114 of these are stamped
    // source='google_books' while carrying only an Open Library id, so the
    // source column cannot be trusted as the filter.
    const { rows } = await pool.query(
      `SELECT b.id, b.slug, b.title, b.isbn13, b.publisher, a.name AS author
         FROM books b JOIN authors a ON a.id = b.author_id
        WHERE b.google_books_id IS NULL
        ORDER BY b.id ${limit ? 'LIMIT ' + limit : ''}`,
    );

    console.log(`${rows.length} row(s) with no Google volume.`);
    console.log(write ? 'WRITING.\n' : 'Dry run — nothing will be written.\n');

    let matched = 0;
    let gainedRating = 0;
    const skipped = [];

    for (const row of rows) {
      const hint = {
        title: row.title,
        author: row.author,
        publisher: row.publisher,
        isbn: row.isbn13,
      };

      let candidates = [];
      try {
        // ISBN first: exact, and scoreCandidate weights a matching ISBN +10, so
        // it cannot be outvoted by a better-looking title.
        if (row.isbn13) candidates = await search(`isbn:${row.isbn13}`, key);
        if (candidates.length === 0) {
          candidates = await search(
            `intitle:${quoted(row.title)} inauthor:${quoted(row.author)}`,
            key,
          );
        }
      } catch (err) {
        skipped.push([row.slug, err.message]);
        await sleep(PAUSE_MS);
        continue;
      }

      const best = candidates
        .map((c) => ({ c, score: scoreCandidate(c, hint) }))
        .sort((a, b) => b.score - a.score)[0];

      // No match leaves the row alone. An Open Library row beats a wrong
      // Google one, and this is somebody's library.
      if (!best || best.score < MIN_SCORE) {
        skipped.push([row.slug, best ? `best score ${best.score.toFixed(2)}` : 'no candidates']);
        await sleep(PAUSE_MS);
        continue;
      }

      matched += 1;
      if (best.c.rating != null) gainedRating += 1;

      const changedTitle = best.c.title !== row.title ? `\n        title: ${row.title}\n            -> ${best.c.title}` : '';
      console.log(
        `  ${row.slug}\n    score ${best.score.toFixed(2)}  ${best.c.googleBooksId}  ` +
          `lang=${best.c.language || '-'}  rating=${best.c.rating ?? '-'}  ` +
          `pub=${best.c.publisher || '-'}${changedTitle}`,
      );

      if (write) {
        await pool.query(
          `UPDATE books SET google_books_id = $1,
                            rating    = COALESCE($2, rating),
                            publisher = COALESCE($3, publisher),
                            pages     = COALESCE($4, pages),
                            cover_url = COALESCE($5, cover_url),
                            language  = COALESCE($6, language)
            WHERE id = $7`,
          [
            best.c.googleBooksId,
            best.c.rating,
            best.c.publisher,
            best.c.pages,
            best.c.coverUrl,
            best.c.language,
            row.id,
          ],
        );
      }

      await sleep(PAUSE_MS);
    }

    console.log(`\n${matched} of ${rows.length} matched; ${gainedRating} would gain a rating.`);
    if (skipped.length > 0) {
      console.log(`${skipped.length} left alone:`);
      for (const [slug, why] of skipped.slice(0, 15)) console.log(`  ${slug}  (${why})`);
      if (skipped.length > 15) console.log(`  …and ${skipped.length - 15} more`);
    }
    if (!write) console.log('\nDry run. Re-run with --write to apply.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
