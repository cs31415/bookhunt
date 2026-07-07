import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAnthropicModel, getAnthropic } from '../../lib/anthropic';
import { extractResponseText } from '../../lib/extract-response-text';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { getS3 } from '../../lib/s3';
import { findBookByTitle } from '../../data/upload-data';
import { searchBooks } from '../ai/search';
import { validateImageKeys } from './validate-image-keys';

export async function detectBooksFromImages(imageKeys: string[], userId: number) {
  await validateImageKeys(imageKeys, userId);

  const imageUrls = await Promise.all(
    imageKeys.map((key) =>
      getSignedUrl(getS3(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }), { expiresIn: 60 }),
    ),
  );

  const imageBlocks = imageUrls.map((url) => ({
    type: 'image' as const,
    source: { type: 'url' as const, url },
  }));

  const response = await getAnthropic().messages.create({
    model: getAnthropicModel(),
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: 'Look at these bookshelf photos. List every book you can identify from the spines. Return ONLY a JSON array of objects with "title" and "author" fields. If you cannot identify the author, use null. Return ONLY valid JSON, no other text.',
        },
      ],
    }],
  });

  const rawText = extractResponseText(response, '[]');
  const books = parseJsonResponse<{ title: string; author: string | null }[]>(rawText);

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
      const query = book.author ? `${book.title} by ${book.author}` : book.title;
      const results = await searchBooks(query, 1);
      detectedBooks.push({
        title: book.title,
        author: book.author,
        ...(results.length > 0 && { resolvedBook: results[0] }),
      });
    }
  }

  return detectedBooks;
}
