import { anthropic } from '../../lib/anthropic';
import { findBookByTitle } from '../../data/upload-data';
import { searchBooks } from '../ai/search';

export async function detectBooksFromImage(imageKey: string) {
  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageKey}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
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
  const books: { title: string; author: string | null }[] = JSON.parse(rawText);

  const detectedBooks = [];
  for (const book of books) {
    const matchedBookId = await findBookByTitle(book.title);
    if (matchedBookId) {
      detectedBooks.push({ title: book.title, author: book.author, matchedBookId });
    } else {
      const query = book.author
        ? `${book.title} by ${book.author}`
        : book.title;
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
