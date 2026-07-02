import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAnthropic } from '../../lib/anthropic';
import { getS3 } from '../../lib/s3';
import { findBookByTitle } from '../../data/upload-data';

export async function detectBooksFromImage(imageKey: string) {
  const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: imageKey });
  const imageUrl = await getSignedUrl(getS3(), command, { expiresIn: 60 });

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        {
          type: 'text',
          text: 'Look at this bookshelf photo. List every book you can identify from the spines. Return ONLY a JSON array of objects with "title" and "author" fields. If you cannot identify the author, use null. Return ONLY valid JSON, no other text.',
        },
      ],
    }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]';
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonText = fenceMatch ? fenceMatch[1] : rawText;
  const books: { title: string; author: string | null }[] = JSON.parse(jsonText.trim());

  const detectedBooks = await Promise.all(
    books.map(async (book) => {
      const matchedBookId = await findBookByTitle(book.title);
      return {
        title: book.title,
        author: book.author,
        ...(matchedBookId && { matchedBookId }),
      };
    }),
  );

  return detectedBooks;
}
