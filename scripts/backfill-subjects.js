/**
 * Run the subject rules over books imported before they existed.
 *
 *   node scripts/backfill-subjects.js            -- shows the diff, writes nothing
 *   node scripts/backfill-subjects.js --limit 5  -- look at a handful
 *   node scripts/backfill-subjects.js --write    -- apply it
 *   node scripts/backfill-subjects.js --force    -- also allows a non-local host
 *
 * curateSubjects cleans what the provider adapters return (LOS-300), but a book
 * already in the catalog keeps whatever it arrived with -- Sapiens held 54
 * subjects, of which 21 survive the rules. Those rows feed search facets and
 * library filters as well as the book page.
 *
 * CommonJS, not TypeScript, for the same reason backfill-handles.js is: the
 * production image prunes devDependencies, so there is no tsx on the server to
 * run a .ts file with. It requires the compiled curator instead of copying the
 * rules, so there is still exactly one set of them -- which does mean `npm run
 * build` has to have run. The deployed image is built, so on the server this
 * is already true.
 *
 * Listing is the default, because the rewrite is lossy: a subject the rules
 * drop comes back only by re-importing the book. Read the diff first.
 *
 * No LLM calls, so this is cheap and safe to re-run -- curateSubjects is
 * idempotent and only rows that actually change are written.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Same .env handling as backfill-handles.js: the app loads it through dotenv at
// startup, a standalone script has to do it itself. Existing environment wins.
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

const distCurator = path.join(ROOT, 'dist/lib/books/curate-subjects.js');
if (!fs.existsSync(distCurator)) {
  console.error(`No compiled curator at ${distCurator}.`);
  console.error('Run `npm run build` first; this script uses the same rules the API does.');
  process.exit(1);
}
const { curateSubjects } = require(distCurator);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);

const args = process.argv.slice(2);
const write = args.includes('--write');
const force = args.includes('--force');

function parseNumberFlag(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = parseInt(args[index + 1] ?? '', 10);
  if (Number.isNaN(value) || value < 1) {
    console.error(`${flag} needs a positive integer`);
    process.exit(1);
  }
  return value;
}

async function reportTotals(pool, label) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS books,
            COALESCE(SUM(array_length(subjects, 1)), 0)::int AS subjects,
            COALESCE(MAX(array_length(subjects, 1)), 0)::int AS most
     FROM books
     WHERE COALESCE(array_length(subjects, 1), 0) > 0`,
  );
  const { books, subjects, most } = rows[0];
  const average = books === 0 ? '0' : (subjects / books).toFixed(1);
  console.log(`${label}: ${subjects} subjects over ${books} books, ${average} each on average, ${most} at most`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set (looked in the environment and .env).');
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    console.error('DATABASE_URL is not a valid URL.');
    process.exit(1);
  }

  const host = parsed.hostname;
  const name = parsed.pathname.replace(/^\//, '');

  // A host guard, not a write guard, and only that: --list is read-only, so it
  // is the write that has to answer for the target.
  if (write && !LOCAL_HOSTS.has(host) && !force) {
    console.error(`Refusing to write to a non-local database (host: ${host}).`);
    console.error('Pass --force if that is genuinely what you want.');
    process.exit(1);
  }

  console.log(`Target: ${name} on ${host || 'localhost'}\n`);

  const limit = parseNumberFlag('--limit');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await reportTotals(pool, 'Before');

    const { rows } = await pool.query(
      `SELECT id, title, subjects
       FROM books
       WHERE COALESCE(array_length(subjects, 1), 0) > 0
       ORDER BY id
       ${limit ? 'LIMIT $1' : ''}`,
      limit ? [limit] : [],
    );

    const changed = rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        subjects: row.subjects ?? [],
        curated: curateSubjects(row.subjects ?? []),
      }))
      .filter((book) => book.curated.join(' ') !== book.subjects.join(' '));

    console.log(`\n${changed.length} of ${rows.length} books would change.\n`);

    // Both lists in full, rather than a kept/dropped split: the rules rewrite
    // as well as remove ("Science fiction, general" becomes "Science fiction"),
    // and a split would file a rename under dropped.
    for (const book of changed) {
      console.log(`  ${book.id}  ${book.title}  ${book.subjects.length} -> ${book.curated.length}`);
      console.log(`    was: ${book.subjects.join(' | ')}`);
      console.log(`    now: ${book.curated.join(' | ') || '(none)'}`);
    }

    if (!write) {
      console.log('\nNothing written. Re-run with --write to apply.');
      return;
    }

    console.log(`\nWriting ${changed.length} books...`);
    for (const book of changed) {
      await pool.query('UPDATE books SET subjects = $2 WHERE id = $1', [book.id, book.curated]);
    }

    await reportTotals(pool, 'After');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
