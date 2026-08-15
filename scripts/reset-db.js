/**
 * Reset the database: drop every table and type, recreate them, reload the
 * stored functions.
 *
 *   npm run db:reset              -- asks for confirmation
 *   npm run db:reset -- --yes     -- skips it, for scripted use
 *   npm run db:reset -- --force   -- also allows a non-local host
 *
 * This destroys all data, so it does three things before touching anything:
 * reports which database it is pointed at, counts what is about to be lost, and
 * refuses a remote host outright unless forced. The count is the useful part --
 * a DATABASE_URL left pointing somewhere unexpected shows up as a row count
 * that does not match what you thought you were resetting.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// The app reads .env through dotenv at startup; a standalone script has to do
// it itself. Existing environment wins, so DATABASE_URL=... npm run db:reset
// works for pointing at a scratch database.
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

// setup_data.sql last: the seed content it loads needs the tables to exist, and
// nothing in the functions depends on those rows.
const SQL_FILES = ['drop_tables.sql', 'setup_tables.sql', 'setup_functions.sql', 'setup_data.sql'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);
const TABLES = ['users', 'authors', 'books', 'library_entries', 'user_favorites', 'messages', 'ai_summaries', 'user_pinned_searches', 'canned_search_draws'];

const args = process.argv.slice(2);
const skipPrompt = args.includes('--yes') || args.includes('-y');
const force = args.includes('--force');

/** Row counts for whatever tables exist, so the operator sees the cost first. */
async function summarise(pool) {
  const counts = [];
  for (const table of TABLES) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      counts.push(`${table}: ${rows[0].count}`);
    } catch {
      // Missing table is the expected case on a fresh database, not an error.
      counts.push(`${table}: --`);
    }
  }
  return counts;
}

function confirm(question) {
  // Non-interactive without --yes is a refusal rather than a hang: this runs in
  // terminals and, sooner or later, in something that is not one.
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

function runSqlFile(databaseUrl, file) {
  const fullPath = path.join(ROOT, 'database', file);
  process.stdout.write(`  ${file} ... `);
  // psql rather than pg: the setup files use \ir to include their parts, which
  // is a psql client directive the driver knows nothing about.
  const result = spawnSync(
    'psql',
    [databaseUrl, '--quiet', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-f', fullPath],
    { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
  );

  if (result.error && result.error.code === 'ENOENT') {
    console.log('failed');
    console.error('\npsql not found on PATH. It is required to run the .sql files.');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.log('failed');
    console.error(`\n${result.stderr || `psql exited ${result.status}`}`);
    process.exit(1);
  }
  console.log('ok');
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
    console.error(`Refusing to reset a non-local database (host: ${host}).`);
    console.error('Pass --force if that is genuinely what you want.');
    process.exit(1);
  }

  console.log(`Target:   ${name} on ${host || 'localhost'}`);

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const counts = await summarise(pool);
    console.log(`Contents: ${counts.join(', ')}`);
  } catch (error) {
    console.error(`Could not connect: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }

  if (!skipPrompt) {
    console.log('\nThis drops every table and all data in it. There is no undo.');
    // Typing the name rather than "y": the whole risk here is resetting the
    // wrong database, and a name is the one answer a wrong target fails.
    const answer = await confirm(`Type the database name (${name}) to continue: `);
    if (answer !== name) {
      console.log('Cancelled.');
      process.exit(0);
    }
  }

  console.log('');
  for (const file of SQL_FILES) runSqlFile(databaseUrl, file);
  console.log(`\nReset ${name}.`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
