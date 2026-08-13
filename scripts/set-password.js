/**
 * Sets an account's password. The operator's escape hatch for a reader locked
 * out with no reset flow (LOS-240) or whose reset mail never arrived.
 *
 *   node scripts/set-password.js reader@example.com          # update directly
 *   node scripts/set-password.js reader@example.com --sql    # print the UPDATE
 *
 * The password is read from a hidden prompt and never appears in an argument,
 * so it stays out of shell history and out of the process list.
 *
 * --sql exists for production, where the app runs from a dist-only image with no
 * scripts/ and the database is not reachable from outside the host. Hash here,
 * then run the printed statement over psql on the box. A bcrypt hash in shell
 * history is not a secret in the way the password is.
 *
 * Deliberately a script rather than an endpoint, for the same reason as
 * verification-link.js: this needs shell access, and that is the right bar.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

for (const envPath of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const bcrypt = require('bcryptjs');

/**
 * Piped input, read once and handed out a line at a time.
 *
 * Buffered up front rather than read per prompt because a second readline over
 * an already-consumed stdin never yields a line — the confirmation prompt just
 * hangs, which is what a naive per-prompt implementation does here.
 */
let pipedLines = null;

async function readPipedLines() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('').split('\n');
}

/**
 * Reads a line without echoing it, so the password never reaches the terminal.
 *
 * Falls back to piped input when stdin is not a TTY. The muting works by
 * rewriting the prompt on every keystroke, which needs a terminal to rewrite;
 * without the fallback the script could not be piped or tested at all.
 */
async function promptHidden(question) {
  if (!process.stdin.isTTY) {
    if (pipedLines === null) pipedLines = await readPipedLines();
    return pipedLines.shift() ?? '';
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      // Stop muting once the line is done, or the next prompt is invisible too.
      if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
      else rl.output.write('\x1B[2K\x1B[200D' + question);
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

// Matches validatePassword on the API. Kept in step by hand, like the web app's
// copy: the point here is to refuse a password the app would reject anyway.
const MIN_PASSWORD_LENGTH = 8;

async function main() {
  const email = process.argv[2];
  const sqlOnly = process.argv.includes('--sql');

  if (!email || email.startsWith('--')) {
    console.error('Usage: node scripts/set-password.js <email> [--sql]');
    process.exit(1);
  }

  const password = await promptHidden(`New password for ${email}: `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Too short — the app requires at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  const again = await promptHidden('Again: ');
  if (password !== again) {
    console.error('They do not match.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  if (sqlOnly) {
    // Single-quoted and bcrypt hashes contain no quotes, so this is safe to paste.
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = '${email}';`);
    return;
  }

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rowCount } = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
      hash,
      email,
    ]);
    if (rowCount === 0) {
      console.error(`No account for ${email}.`);
      process.exit(1);
    }
    console.log(`Password set for ${email}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
