/**
 * Give a handle to every account that predates LOS-248.
 *
 *   node scripts/backfill-handles.js            -- shows the plan, asks first
 *   node scripts/backfill-handles.js --yes      -- skips the prompt
 *   node scripts/backfill-handles.js --force    -- also allows a non-local host
 *
 * Handles come from the email local-part, sanitised to the alphabet the app
 * accepts and suffixed with a number where two accounts would otherwise collide.
 * The result is not always pretty; it is always usable, and the reader can
 * rename it from settings afterwards.
 *
 * Safe to run repeatedly: accounts that already have a handle are skipped, so a
 * partial run finishes cleanly on the next one.
 *
 * Order: alter/add_user_handle.sql, this script, then
 * alter/set_user_handle_not_null.sql.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');

// Same .env handling as reset-db.js: the app loads it through dotenv at
// startup, a standalone script has to do it itself. Existing environment wins.
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);
const MIN_LENGTH = 3;
const MAX_LENGTH = 30;

// Duplicated from src/lib/validate/reserved-handles.ts on purpose: this is a
// plain CommonJS script and cannot import the TypeScript module. Keep the two
// in step -- the TypeScript file is the source of truth.
const RESERVED = new Set([
  'search', 'library', 'login', 'register', 'logout', 'verify-email',
  'forgot-password', 'reset-password', 'books', 'authors', 'settings',
  'messages', 'favorites', 'discover', 'about', 'help', 'terms', 'privacy',
  'contact', 'admin', 'api', 'bff', 'static', 'assets', 'public', 'me', 'new',
  'home', 'profile', 'account', 'notifications', 'explore', 'support',
  'bookhunt',
]);

const args = process.argv.slice(2);
const skipPrompt = args.includes('--yes') || args.includes('-y');
const force = args.includes('--force');

/**
 * The best handle this address can give us, before collisions are considered.
 * Falls back to "reader" when the local-part sanitises away to nothing, which
 * an address like 42@example.com does.
 */
function handleFromEmail(email) {
  const localPart = String(email).split('@')[0].toLowerCase();

  let candidate = localPart
    .replace(/[^a-z0-9_]/g, '_')  // dots, plus-addressing and hyphens all fold to _
    .replace(/_+/g, '_')          // ada..reader would otherwise become ada__reader
    .replace(/^_+|_+$/g, '')      // a leading _ is invalid, a trailing one is just noise
    .replace(/^[^a-z]+/, '');     // must start with a letter

  if (candidate.length === 0) candidate = 'reader';
  if (candidate.length > MAX_LENGTH) candidate = candidate.slice(0, MAX_LENGTH);
  while (candidate.length < MIN_LENGTH) candidate += '0';

  return candidate;
}

/**
 * Appends the lowest free numeric suffix, trimming the stem so the result still
 * fits VARCHAR(30). `taken` holds lowercase handles and is updated in place, so
 * two accounts backfilled in the same run cannot be handed the same name.
 */
function makeUnique(base, taken) {
  if (!taken.has(base) && !RESERVED.has(base)) {
    taken.add(base);
    return base;
  }

  for (let suffix = 2; ; suffix += 1) {
    const tail = String(suffix);
    const stem = base.slice(0, MAX_LENGTH - tail.length);
    const candidate = `${stem}${tail}`;
    if (!taken.has(candidate) && !RESERVED.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

function confirm(question) {
  if (!process.stdin.isTTY) {
    console.error('Not a terminal. Re-run with --yes to confirm non-interactively.');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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

  if (!LOCAL_HOSTS.has(host) && !force) {
    console.error(`Refusing to write to a non-local database (host: ${host}).`);
    console.error('Pass --force if that is genuinely what you want.');
    process.exit(1);
  }

  console.log(`Target: ${name} on ${host || 'localhost'}\n`);

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const { rows: existing } = await pool.query(
      'SELECT LOWER(handle) AS handle FROM users WHERE handle IS NOT NULL',
    );
    const taken = new Set(existing.map((row) => row.handle));

    const { rows: pending } = await pool.query(
      'SELECT id, email FROM users WHERE handle IS NULL ORDER BY id',
    );

    if (pending.length === 0) {
      console.log('Every account already has a handle. Nothing to do.');
      return;
    }

    // Planned first, applied second, so the operator sees every name before any
    // of them is written.
    const plan = pending.map((user) => ({
      id: user.id,
      email: user.email,
      handle: makeUnique(handleFromEmail(user.email), taken),
    }));

    console.log(`${plan.length} account(s) to backfill:\n`);
    for (const row of plan) {
      console.log(`  ${String(row.id).padStart(5)}  ${row.email}  ->  @${row.handle}`);
    }

    if (!skipPrompt) {
      const answer = await confirm('\nApply these handles? [y/N] ');
      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        return;
      }
    }

    // One transaction: a half-backfilled table would leave the NOT NULL step
    // failing with no clear account of which rows had been handled.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of plan) {
        await client.query('UPDATE users SET handle = $1 WHERE id = $2', [row.handle, row.id]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log(`\nBackfilled ${plan.length} account(s).`);
    console.log('Next: psql -d <db> -f database/alter/set_user_handle_not_null.sql');
  } finally {
    await pool.end();
  }
}

// Guarded so the tests can require the naming helpers without the script
// connecting to a database and prompting.
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { handleFromEmail, makeUnique };
