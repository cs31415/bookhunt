/**
 * Mail the day's invite requests, once (LOS-381).
 *
 *   node scripts/invite-digest.js            -- sends, and marks them reported
 *   node scripts/invite-digest.js --dry-run  -- prints, marks nothing
 *
 * Run from host cron through the api container:
 *   0 8 * * * cd /opt/bookhunt-deploy && \
 *     docker compose exec -T api node /app/scripts/invite-digest.js
 *
 * CommonJS, because there is no tsx on the droplet.
 *
 * Three things here are deliberate:
 *
 *   Rows carry notified_at rather than the digest asking for "the last 24
 *   hours". A time window silently drops requests whenever a run is missed -- a
 *   reboot, a deploy, a failed cron -- and nobody finds out. With a flag, a
 *   missed day just makes tomorrow's email longer.
 *
 *   Nothing is sent when there is nothing. A daily "no requests today" teaches
 *   you to ignore the message, and then you miss the one that matters.
 *
 *   The body is capped. A flood makes the row count grow, not the email, which
 *   is the point of a queue that cannot be made to shout at you.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

/** Listed in full up to here; beyond it the email says how many more. */
const MAX_LISTED = 50;
/** Read past the cap so the "and N more" number is real rather than "50+". */
const MAX_FETCHED = 1000;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBody(rows) {
  const listed = rows.slice(0, MAX_LISTED);
  const overflow = rows.length - listed.length;

  const lines = listed.map((r) => {
    const when = new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16);
    return r.note ? `${when}  ${r.email}\n              ${r.note}` : `${when}  ${r.email}`;
  });

  let text = `${rows.length} invite request${rows.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}`;
  if (overflow > 0) text += `\n\n…and ${overflow} more, not listed.`;
  text += `\n\nMint a code with:\n  docker compose exec -T api node /app/scripts/mint-invite.js --new "for them"\n`;

  const html = `<p>${rows.length} invite request${rows.length === 1 ? '' : 's'}:</p><pre>${escapeHtml(
    lines.join('\n'),
  )}</pre>${overflow > 0 ? `<p>…and ${overflow} more, not listed.</p>` : ''}`;

  return { text, html };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const to = process.env.INVITE_DIGEST_TO;

  // Unset means do nothing, rather than guess an address to mail.
  if (!to && !dryRun) {
    console.log('INVITE_DIGEST_TO is not set; nothing sent.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query('SELECT * FROM fn_pending_invite_requests($1)', [MAX_FETCHED]);

    if (rows.length === 0) {
      console.log('No new invite requests; nothing sent.');
      return;
    }

    const { text, html } = buildBody(rows);

    if (dryRun) {
      console.log(text);
      console.log('\n--dry-run: nothing sent, nothing marked.');
      return;
    }

    // Required lazily: dist/ only exists in the built image, and --dry-run
    // should work from a checkout without it.
    const { sendEmail } = require(path.join(ROOT, 'dist/lib/email/send-email'));

    const subject = `BookHunt: ${rows.length} invite request${rows.length === 1 ? '' : 's'}`;
    const sent = await sendEmail({ to, subject, html, text });

    // Marked only after the send lands. A failure leaves them pending, so the
    // next run picks them up rather than losing a day of people.
    if (!sent) {
      console.error('Digest was not sent; leaving requests pending for the next run.');
      process.exitCode = 1;
      return;
    }

    const marked = await pool.query('SELECT fn_mark_invite_requests_notified($1) AS count', [
      rows.map((r) => r.id),
    ]);
    console.log(`Sent ${rows.length} request(s) to ${to}; marked ${marked.rows[0].count}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
