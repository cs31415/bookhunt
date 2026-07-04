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

async function getToken() {
  console.log(`Registering ${email} ...`);
  const registerRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const registerData = await registerRes.json();

  if (registerRes.ok) {
    console.log('User registered.\n');
    return registerData.token;
  }

  if (registerRes.status === 409) {
    console.log(`Already registered — logging in ...\n`);
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
    console.log('Logged in.\n');
    return loginData.token;
  }

  console.error('Register failed:', registerRes.status, registerData);
  process.exit(1);
}

async function main() {
  const photoFile = process.argv[2] || 'IMG_6473.jpeg';
  const photoPath = path.join(PHOTO_DIR, photoFile);

  if (!fs.existsSync(photoPath)) {
    console.error(`Photo not found: ${photoPath}`);
    process.exit(1);
  }

  console.log('=== Photo Import Test ===\n');

  // 1. Register or login
  const token = await getToken();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Get presigned upload URL
  console.log('Requesting presigned URL ...');
  const presignRes = await fetch(`${API}/upload/presign`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ files: [{ contentType: 'image/jpeg' }] }),
  });
  const presignData = await presignRes.json();

  if (!presignRes.ok) {
    console.error('Presign failed:', presignRes.status, presignData);
    process.exit(1);
  }

  const { url: presignUrl, key: imageKey } = presignData[0];
  console.log('Image key:', imageKey);
  console.log('Presigned URL:', presignUrl.slice(0, 60) + '...\n');

  // 3. Upload photo to presigned URL
  console.log(`Uploading ${photoFile} ...`);
  const imageBytes = fs.readFileSync(photoPath);
  const uploadRes = await fetch(presignUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: imageBytes,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error('Upload failed:', uploadRes.status, text);
    process.exit(1);
  }

  console.log('Upload successful.\n');

  // 4. Scan the uploaded photo for books
  console.log('Scanning bookshelf photo with AI vision ...');
  const scanRes = await fetch(`${API}/upload/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ imageKeys: [imageKey] }),
  });
  const scanData = await scanRes.json();

  if (!scanRes.ok) {
    console.error('Scan failed:', scanRes.status, scanData);
    process.exit(1);
  }

  const books = scanData.detectedBooks;
  console.log(`Detected ${books.length} book(s):`);
  books.forEach((b, i) => {
    const status = b.matchedBookId
      ? `matched DB id: ${b.matchedBookId}`
      : b.resolvedBook
        ? `resolved via ${b.resolvedBook.source}`
        : 'not found';
    console.log(`  ${i + 1}. "${b.title}" by ${b.author || 'Unknown'} — ${status}`);
  });

  // 5. Add books to library: DB-matched via matchedBookId, search-resolved via resolvedBook
  const toAdd = books.filter((b) => b.matchedBookId || b.resolvedBook);
  console.log(`\nAdding ${toAdd.length} book(s) to library ...`);

  for (const book of toAdd) {
    let payload;
    if (book.matchedBookId) {
      payload = {
        googleBooksId: `scan-${book.matchedBookId}`,
        title: book.title,
        authorName: book.author || 'Unknown',
        slug: book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'queued',
      };
    } else {
      const rb = book.resolvedBook;
      payload = {
        googleBooksId: rb.googleBooksId || `ol-${rb.isbn13 || book.title.toLowerCase().replace(/\s+/g, '-')}`,
        title: rb.title,
        authorName: rb.authors[0] || book.author || 'Unknown',
        slug: rb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        year: rb.year,
        publisher: rb.publisher,
        pages: rb.pages,
        rating: rb.rating,
        coverUrl: rb.coverUrl,
        isbn13: rb.isbn13,
        language: rb.language,
        blurb: rb.blurb,
        status: 'queued',
      };
    }

    const addRes = await fetch(`${API}/library`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const addData = await addRes.json();

    if (addRes.ok) {
      console.log(`  Added "${book.title}" — entry ID: ${addData.entry?.id ?? addData.id}`);
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
