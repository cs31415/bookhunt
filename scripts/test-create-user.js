const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const API = process.env.API_URL || 'http://localhost:3001/api';
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const displayName = process.env.TEST_DISPLAY_NAME;

async function main() {
  console.log('=== Create User Test ===\n');

  // 1. Register
  console.log(`Registering ${email} ...`);
  const registerRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const registerData = await registerRes.json();

  if (!registerRes.ok) {
    console.error('Register failed:', registerRes.status, registerData);
    process.exit(1);
  }

  console.log('User created:', registerData.user);
  console.log('Token:', registerData.token.slice(0, 20) + '...\n');

  // 2. Login with the same credentials
  console.log('Logging in ...');
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();

  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, loginData);
    process.exit(1);
  }

  console.log('Login successful:', loginData.user);

  // 3. Verify token works on an authenticated endpoint
  console.log('\nVerifying token on /library ...');
  const libraryRes = await fetch(`${API}/library`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const libraryData = await libraryRes.json();

  if (!libraryRes.ok) {
    console.error('Library fetch failed:', libraryRes.status, libraryData);
    process.exit(1);
  }

  console.log('Library entries:', libraryData.entries.length);
  console.log('Stats:', libraryData.stats);

  // 4. Duplicate registration should fail with 409
  console.log('\nAttempting duplicate registration ...');
  const dupRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const dupData = await dupRes.json();

  if (dupRes.status === 409) {
    console.log('Correctly rejected duplicate:', dupData.error);
  } else {
    console.error('Expected 409, got:', dupRes.status, dupData);
    process.exit(1);
  }

  console.log('\n=== All checks passed ===');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
