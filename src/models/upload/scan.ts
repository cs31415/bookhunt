import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { completeVision } from '../../lib/llm/complete-vision';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { getS3 } from '../../lib/s3';
import { findBookByTitle } from '../../data/upload-data';
import { resolveDetectedBook } from './resolve-detected-book';
import { validateImageKeys } from './validate-image-keys';

export async function detectBooksFromImages(imageKeys: string[], userId: number) {
  await validateImageKeys(imageKeys, userId);

  // 300s expiry gives the fallback chain room: a later provider may fetch the
  // URLs long after the first attempt started.
  const imageUrls = await Promise.all(
    imageKeys.map((key) =>
      getSignedUrl(getS3(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }), { expiresIn: 300 }),
    ),
  );

  const books = await completeVision(
    imageUrls,
    'Look at these bookshelf photos. List every book you can identify from the spines. Return ONLY a JSON array of objects with "title" and "author" fields. If you cannot identify the author, use null. Return ONLY valid JSON, no other text.',
    {
      maxTokens: 2048,
      transform: (rawText) => parseJsonResponse<{ title: string; author: string | null }[]>(rawText),
    },
  );

  const seen = new Set<string>();
  const unique = books.filter((book) => {
    const key = `${book.title.toLowerCase()}||${book.author}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const detectedBooks = [];
  for (const book of unique) {
    const matchedBookId = await findBookByTitle(book.title);
    if (matchedBookId) {
      detectedBooks.push({ title: book.title, author: book.author, matchedBookId });
    } else {
      const resolvedBook = await resolveDetectedBook(book.title, book.author);
      detectedBooks.push({
        title: book.title,
        author: book.author,
        ...(resolvedBook && { resolvedBook }),
      });
    }
  }

  return detectedBooks;
}
