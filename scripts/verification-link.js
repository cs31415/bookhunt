/**
 * Prints the outstanding verification link for an account.
 *
 * With RESEND_API_KEY set the link is deliberately never logged (see
 * lib/email/send-email.ts), so when an email is delayed or filtered the only
 * way to recover one is from the database. This does that.
 *
 * Deliberately a script rather than an HTTP endpoint: the app has no admin
 * role, and an endpoint handing out verification tokens would be new public
 * attack surface for what is an operator convenience. This needs shell access
 * and DATABASE_URL, which is the bar it should sit behind.
 *
 *   node scripts/verification-link.js reader@example.com
 *
 * In production the app runs from a dist-only image with no scripts/, so use
 * the psql form documented in the bookhunt-deploy README instead.
 */
const fs = require('fs');
const path = require('path');

// Same .env loading as the other scripts here: scripts/.env first, then the
// repo's own .env, without overriding anything already in the environment.
for (const envPath of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

function frontendUrl(p) {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/verification-link.js <email>');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT email_verified_at, verification_token, verification_token_expires_at
         FROM users WHERE email = $1`,
      [email],
    );

    if (rows.length === 0) {
      console.error(`No account for ${email}.`);
      process.exit(1);
    }

    const { email_verified_at, verification_token, verification_token_expires_at } = rows[0];

    if (email_verified_at) {
      console.log(`${email} is already verified (${email_verified_at.toISOString()}). Nothing to do.`);
      return;
    }

    // An unverified account with no token means the token was consumed or
    // cleared; the reader needs to ask for a new one from the sign-up screen,
    // which is a different thing from the link merely being lost in a spam
    // folder, so say which.
    if (!verification_token) {
      console.error(`${email} is unverified but has no token. Use "Resend the email" to mint a new one.`);
      process.exit(1);
    }

    const expired = verification_token_expires_at && verification_token_expires_at < new Date();
    console.log(frontendUrl(`/verify-email?token=${encodeURIComponent(verification_token)}`));
    console.log(
      expired
        ? `  EXPIRED ${verification_token_expires_at.toISOString()} — resend to mint a new one`
        : `  valid until ${verification_token_expires_at.toISOString()}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
