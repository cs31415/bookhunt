const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const API = process.env.API_URL;
const PHOTO_DIR = path.join(__dirname, 'photos');
const UPLOAD_CACHE_PATH = path.join(__dirname, '.upload-cache.json');

function loadUploadCache() {
  try { return JSON.parse(fs.readFileSync(UPLOAD_CACHE_PATH, 'utf8')); } catch { return {}; }
}

function saveUploadCache(cache) {
  fs.writeFileSync(UPLOAD_CACHE_PATH, JSON.stringify(cache, null, 2));
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const DEFAULT_TIMEOUT_MS = 10_000;
const SCAN_TIMEOUT_MS = 120_000;
const BULK_TIMEOUT_MS = 60_000;

function apiFetch(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  return { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
           '.heic': 'image/heic', '.webp': 'image/webp' }[ext] ?? 'image/jpeg';
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const displayName = process.env.TEST_DISPLAY_NAME;

async function main() {
  const photoFiles = process.argv.slice(2).length ? process.argv.slice(2) : ['IMG_6458.jpeg'];

  for (const f of photoFiles) {
    if (!fs.existsSync(path.join(PHOTO_DIR, f))) {
      console.error(`Photo not found: ${path.join(PHOTO_DIR, f)}`);
      process.exit(1);
    }
  }

  console.log(`=== Photo Import Test (${photoFiles.length} photo(s)) ===\n`);

  // 1. Register or login
  console.log(`Registering ${email} ...`);
  const registerRes = await apiFetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const registerData = await registerRes.json();

  let token;
  if (registerRes.ok) {
    token = registerData.token;
    console.log('User registered.\n');
  } else if (registerRes.status === 409) {
    console.log('User already exists — logging in ...');
    const loginRes = await apiFetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed:', loginRes.status, loginData);
      process.exit(1);
    }
    token = loginData.token;
    console.log('Logged in.\n');
  } else {
    console.error('Register failed:', registerRes.status, registerData);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Hash each photo and check cache for already-uploaded files
  const uploadCache = loadUploadCache();
  const hashes = photoFiles.map((f) => fileHash(path.join(PHOTO_DIR, f)));

  const cached = [], toUpload = [];
  photoFiles.forEach((f, i) => {
    const key = uploadCache[hashes[i]];
    if (key) cached.push({ file: f, index: i, key });
    else toUpload.push({ file: f, index: i, hash: hashes[i] });
  });

  if (cached.length) console.log(`  ${cached.length} already uploaded (cache hit), skipping.`);

  const imageKeys = new Array(photoFiles.length);
  cached.forEach(({ index, key, file }) => {
    console.log(`  [${index + 1}] ${file} — cache hit: ${key}`);
    imageKeys[index] = key;
  });

  // 3. Presign and upload only files not in the cache
  if (toUpload.length > 0) {
    console.log(`\nRequesting presigned URL(s) for ${toUpload.length} new file(s) ...`);
    const presignRes = await apiFetch(`${API}/upload/presign`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ files: toUpload.map((f) => ({ contentType: contentTypeFor(f.file) })) }),
    });
    const presignData = await presignRes.json();

    if (!presignRes.ok) {
      console.error('Presign failed:', presignRes.status, presignData);
      process.exit(1);
    }

    console.log(`Uploading ${toUpload.length} photo(s) to S3 in parallel ...`);
    const uploadResults = await Promise.allSettled(
      toUpload.map(({ file }, pi) => {
        // Presigned POST: send every policy field, then the file as the last part
        const form = new FormData();
        for (const [name, value] of Object.entries(presignData[pi].fields)) form.append(name, value);
        form.append(
          'file',
          new Blob([fs.readFileSync(path.join(PHOTO_DIR, file))], { type: contentTypeFor(file) }),
          file
        );
        return fetch(presignData[pi].url, { method: 'POST', body: form }).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
          return r;
        });
      })
    );

    uploadResults.forEach((result, pi) => {
      const { file, index, hash } = toUpload[pi];
      if (result.status === 'fulfilled') {
        const key = presignData[pi].key;
        console.log(`  [${index + 1}] ${file} — uploaded: ${key}`);
        imageKeys[index] = key;
        uploadCache[hash] = key;
      } else {
        console.error(`  [${index + 1}] ${file} — FAILED: ${result.reason.message}`);
        console.error('  (R2/S3 credentials may not be configured — set AWS_* env vars in scripts/.env)');
      }
    });

    saveUploadCache(uploadCache);
  }

  const imageKeysFiltered = imageKeys.filter(Boolean);
  if (imageKeysFiltered.length === 0) {
    console.error('\nNo photos available. Aborting.');
    process.exit(1);
  }

  console.log();

  // 4. Scan all uploaded photos — server resolves each book via Google Books + OpenLibrary fallback
  console.log(`Scanning ${imageKeysFiltered.length} photo(s) with AI vision ...`);
  const scanRes = await apiFetch(`${API}/upload/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ imageKeys: imageKeysFiltered }),
  }, SCAN_TIMEOUT_MS);
  const scanData = await scanRes.json();

  if (!scanRes.ok) {
    console.error('Scan failed:', scanRes.status, scanData);
    process.exit(1);
  }

  const detectedBooks = scanData.detectedBooks;
  console.log(`\nDetected ${detectedBooks.length} book(s):`);
  detectedBooks.forEach((b, i) => {
    const status = b.matchedBookId
      ? `catalog ID: ${b.matchedBookId}`
      : b.resolvedBook
        ? `resolved via ${b.resolvedBook.source}`
        : 'not found';
    console.log(`  ${i + 1}. "${b.title}" by ${b.author || 'Unknown'} — ${status}`);
  });

  if (detectedBooks.length === 0) {
    console.log('\nNo books detected. Skipping library step.');
    console.log('\n=== Photo import test complete ===');
    return;
  }

  // 5. Build bulk-add payload from resolvedBook metadata; skip DB-matched (already in catalog)
  const booksToAdd = [];
  for (const b of detectedBooks) {
    if (b.resolvedBook) {
      const rb = b.resolvedBook;
      booksToAdd.push({
        googleBooksId: rb.googleBooksId || `ol-${rb.isbn13 || slugify(rb.title)}`,
        slug: slugify(rb.title),
        title: rb.title,
        authorName: rb.authors?.[0] || b.author || 'Unknown',
        year: rb.year,
        publisher: rb.publisher,
        pages: rb.pages,
        subjects: null,
        blurb: rb.blurb,
        coverUrl: rb.coverUrl,
        isbn13: rb.isbn13,
        language: rb.language,
        status: 'queued',
      });
    }
  }

  if (booksToAdd.length === 0) {
    console.log('\nNo books resolved from search. Skipping library step.');
    console.log('\n=== Photo import test complete ===');
    return;
  }

  // 6. Bulk-add all resolved books to the user's library (in chunks of 20)
  const CHUNK_SIZE = 20;
  const chunks = [];
  for (let i = 0; i < booksToAdd.length; i += CHUNK_SIZE) chunks.push(booksToAdd.slice(i, i + CHUNK_SIZE));

  console.log(`\nBulk-adding ${booksToAdd.length} book(s) to library (${chunks.length} batch(es)) ...`);

  let totalAdded = 0, totalFailed = 0;
  for (const [ci, chunk] of chunks.entries()) {
    const bulkRes = await apiFetch(`${API}/library/bulk`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ books: chunk }),
    }, BULK_TIMEOUT_MS);
    const bulkData = await bulkRes.json();

    if (!bulkRes.ok && bulkRes.status !== 207) {
      console.error(`  batch ${ci + 1} failed: ${bulkRes.status}`, bulkData);
      continue;
    }

    bulkData.entries.forEach((entry) => {
      console.log(`  added  book ID ${entry.book_id} — status: ${entry.status}`);
    });
    bulkData.errors.forEach((err) => {
      console.error(`  error  [${err.index}] ${err.googleBooksId}: ${err.reason}`);
    });
    totalAdded += bulkData.entries.length;
    totalFailed += bulkData.errors.length;
  }
  console.log(`  ${totalAdded} added, ${totalFailed} failed`);

  // 7. Verify library contents
  console.log('\nFetching library ...');
  const libRes = await apiFetch(`${API}/library`, {
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
