/**
 * End-to-end check of the registration flow against a running API.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/test-create-user.js
 *
 * Registration no longer returns a session token: an account has to verify its
 * address before it can sign in (LOS-218). There is no way to read the emailed
 * link over HTTP, so this reaches into Postgres for the verification token --
 * which is also the only part of the flow a caller cannot exercise on its own,
 * and worth knowing is covered.
 */

const fs = require('fs');
const path = require('path');

// scripts/.env holds the test account; the root .env holds DATABASE_URL. Both
// are read here because a standalone script gets no dotenv from index.ts.
for (const envPath of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

const API = process.env.API_URL || 'http://localhost:3001/api';
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const displayName = process.env.TEST_DISPLAY_NAME;

function fail(message, ...rest) {
  console.error(message, ...rest);
  process.exit(1);
}

async function post(pathname, body) {
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json() };
}

async function main() {
  console.log('=== Create User Test ===\n');

  if (!email || !password || !displayName) {
    fail('Set TEST_EMAIL, TEST_PASSWORD and TEST_DISPLAY_NAME in scripts/.env');
  }

  // 1. Register
  console.log(`Registering ${email} ...`);
  const { res: registerRes, data: registerData } = await post('/auth/register', {
    email,
    password,
    displayName,
  });

  if (registerRes.status !== 201) {
    fail('Register failed:', registerRes.status, registerData);
  }
  if (registerData.token) {
    fail('Register returned a session token; it must not sign the account in.');
  }
  console.log('User created:', registerData.user);
  console.log('Verification required:', registerData.verificationRequired, '\n');

  // 2. Signing in before verifying must be refused
  console.log('Logging in before verifying ...');
  const { res: earlyRes, data: earlyData } = await post('/auth/login', { email, password });
  if (earlyRes.status !== 403 || earlyData.code !== 'EMAIL_NOT_VERIFIED') {
    fail('Expected 403 EMAIL_NOT_VERIFIED, got:', earlyRes.status, earlyData);
  }
  console.log('Correctly refused:', earlyData.error, '\n');

  // 3. Verify, using the token the email would have carried
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL is not set (looked in scripts/.env and .env).');

  const pool = new Pool({ connectionString: databaseUrl });
  let verificationToken;
  try {
    const { rows } = await pool.query('SELECT verification_token FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    if (rows.length === 0) fail('No user row found for', email);
    verificationToken = rows[0].verification_token;
    if (!verificationToken) fail('User row has no verification token.');
  } finally {
    await pool.end();
  }

  console.log('Verifying address ...');
  const { res: verifyRes, data: verifyData } = await post('/auth/verify-email', {
    token: verificationToken,
  });
  if (!verifyRes.ok) fail('Verify failed:', verifyRes.status, verifyData);
  if (!verifyData.token) fail('Verify did not return a session token.');
  console.log('Verified and signed in:', verifyData.user, '\n');

  // 4. The token is single-use
  console.log('Reusing the verification token ...');
  const { res: replayRes } = await post('/auth/verify-email', { token: verificationToken });
  if (replayRes.status !== 400) {
    fail('Expected 400 on a spent token, got:', replayRes.status);
  }
  console.log('Correctly rejected a spent token\n');

  // 5. Login now works
  console.log('Logging in ...');
  const { res: loginRes, data: loginData } = await post('/auth/login', { email, password });
  if (!loginRes.ok) fail('Login failed:', loginRes.status, loginData);
  console.log('Login successful:', loginData.user);

  // 6. Verify the token works on an authenticated endpoint
  console.log('\nVerifying token on /library ...');
  const libraryRes = await fetch(`${API}/library`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const libraryData = await libraryRes.json();
  if (!libraryRes.ok) fail('Library fetch failed:', libraryRes.status, libraryData);
  console.log('Library entries:', libraryData.entries.length);
  console.log('Stats:', libraryData.stats);

  // 7. Duplicate registration should fail with 409, including a different case
  console.log('\nAttempting duplicate registration (different case) ...');
  const { res: dupRes, data: dupData } = await post('/auth/register', {
    email: email.toUpperCase(),
    password,
    displayName,
  });
  if (dupRes.status !== 409) {
    fail('Expected 409, got:', dupRes.status, dupData);
  }
  console.log('Correctly rejected duplicate:', dupData.error);

  console.log('\n=== All checks passed ===');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
