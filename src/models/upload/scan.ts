import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { completeVision } from '../../lib/llm/complete-vision';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { getS3 } from '../../lib/s3';
import { chunk, mapWithConcurrency } from '../../lib/map-with-concurrency';
import {
  IMAGES_PER_VISION_CALL,
  RESOLUTION_CONCURRENCY,
  VISION_CHUNK_CONCURRENCY,
  VISION_MAX_TOKENS,
} from '../../lib/upload-constraints';
import { findBookByTitle } from '../../data/upload-data';
import { resolveDetectedBook } from './resolve-detected-book';
import { validateImageKeys } from './validate-image-keys';

interface SpineBook {
  title: string;
  author: string | null;
}

const PROMPT =
  'Look at these bookshelf photos. List every book you can identify from the spines. Return ONLY a JSON array of objects with "title" and "author" fields. If you cannot identify the author, use null. Return ONLY valid JSON, no other text.';

export async function detectBooksFromImages(imageKeys: string[], userId: number) {
  await validateImageKeys(imageKeys, userId);

  // 300s expiry gives the fallback chain room: a later provider may fetch the
  // URLs long after the first attempt started.
  const imageUrls = await Promise.all(
    imageKeys.map((key) =>
      getSignedUrl(getS3(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }), { expiresIn: 300 }),
    ),
  );

  // Split across several vision calls rather than one large one: each call gets
  // its own output-token budget, Gemini's adapter inlines images as base64 so a
  // single request can't hold them all, and recall per photo is better when
  // fewer share a prompt. A chunk that exhausts the model chain fails the whole
  // scan, exactly as a single failed call does — chunking must not quietly
  // downgrade a hard failure into partial results.
  const groups = chunk(imageUrls, IMAGES_PER_VISION_CALL);
  const perGroup = await mapWithConcurrency(groups, VISION_CHUNK_CONCURRENCY, (urls) =>
    completeVision(urls, PROMPT, {
      maxTokens: VISION_MAX_TOKENS,
      transform: (rawText) => parseJsonResponse<SpineBook[]>(rawText),
    }),
  );

  // Dedupe across every chunk before resolving, so a book that appears in three
  // photos costs one catalog lookup rather than three.
  const seen = new Set<string>();
  const unique: SpineBook[] = [];
  for (const book of perGroup.flat()) {
    const key = `${book.title.toLowerCase()}||${book.author}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(book);
  }

  // Bounded concurrency, not a sequential loop: an unmatched book costs a DB
  // query plus up to two provider searches, and a large scan has hundreds of
  // them. mapWithConcurrency keeps detection order in the response.
  return mapWithConcurrency(unique, RESOLUTION_CONCURRENCY, async (book) => {
    const matchedBookId = await findBookByTitle(book.title);
    if (matchedBookId) {
      return { title: book.title, author: book.author, matchedBookId };
    }
    const resolvedBook = await resolveDetectedBook(book.title, book.author);
    return {
      title: book.title,
      author: book.author,
      ...(resolvedBook && { resolvedBook }),
    };
  });
}
