const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const API = process.env.API_URL;
const PHOTO_DIR = path.join(__dirname, 'photos');

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const displayName = process.env.TEST_DISPLAY_NAME;

async function main() {
  const photoFile = process.argv[2] || 'IMG_6455.jpeg';
  const photoPath = path.join(PHOTO_DIR, photoFile);

  if (!fs.existsSync(photoPath)) {
    console.error(`Photo not found: ${photoPath}`);
    process.exit(1);
  }

  console.log('=== Photo Import Test ===\n');

  // 1. Register a test user
  console.log(`Registering ${email} ...`);
  const registerRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const { token } = await registerRes.json();

  if (!registerRes.ok) {
    console.error('Register failed:', registerRes.status);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('User registered.\n');

  // 2. Get presigned upload URL
  console.log('Requesting presigned URL ...');
  const presignRes = await fetch(`${API}/upload/presign`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ contentType: 'image/jpeg' }),
  });
  const presignData = await presignRes.json();

  if (!presignRes.ok) {
    console.error('Presign failed:', presignRes.status, presignData);
    process.exit(1);
  }

  console.log('Image key:', presignData.key);
  console.log('Presigned URL:', presignData.url.slice(0, 60) + '...\n');

  // 3. Upload photo to presigned URL
  console.log(`Uploading ${photoFile} ...`);
  const imageBytes = fs.readFileSync(photoPath);
  const uploadRes = await fetch(presignData.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: imageBytes,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error('Upload failed:', uploadRes.status, text);
    console.error('(R2 credentials may not be configured — set R2_* env vars in api/.env.local)');
    process.exit(1);
  }

  console.log('Upload successful.\n');

  // 4. Scan the uploaded photo for books
  console.log('Scanning bookshelf photo with AI vision ...');
  const scanRes = await fetch(`${API}/upload/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ imageKey: presignData.key }),
  });
  const scanData = await scanRes.json();

  if (!scanRes.ok) {
    console.error('Scan failed:', scanRes.status, scanData);
    process.exit(1);
  }

  const books = scanData.detectedBooks;
  console.log(`Detected ${books.length} book(s):`);
  books.forEach((b, i) => {
    console.log(`  ${i + 1}. "${b.title}" by ${b.author || 'Unknown'}${b.matchedBookId ? ` (matched ID: ${b.matchedBookId})` : ''}`);
  });

  // 5. Add each matched book to the user's library
  const matched = books.filter((b) => b.matchedBookId);
  console.log(`\nAdding ${matched.length} matched book(s) to library ...`);

  for (const book of matched) {
    const addRes = await fetch(`${API}/library`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        googleBooksId: `scan-${book.matchedBookId}`,
        title: book.title,
        authorName: book.author || 'Unknown',
        slug: book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'queued',
      }),
    });
    const addData = await addRes.json();

    if (addRes.ok) {
      console.log(`  Added "${book.title}" — entry ID: ${addData.entry.id}`);
    } else {
      console.error(`  Failed to add "${book.title}":`, addRes.status, addData);
    }
  }

  // 6. Verify library contents
  console.log('\nFetching library ...');
  const libRes = await fetch(`${API}/library`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const libData = await libRes.json();

  console.log(`Library has ${libData.entries.length} entry/entries.`);
  console.log('Stats:', libData.stats);

  console.log('\n=== Photo import test complete ===');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
