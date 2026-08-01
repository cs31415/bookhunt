import { completeText } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { buildVocabularyClause, Vocabularies } from './build-vocabulary-clause';

export interface BookToCategorize {
  title: string;
  authorName: string;
}

export interface BookCategorization {
  index: number;
  categories: string[];
  themes: string[];
  moods: string[];
}

/**
 * Categorize a list of books in one call.
 *
 * A batch is not just cheaper than one call per book -- it is the only way the
 * model can group. Asked about a book alone it describes that book, which is
 * how the catalog ended up with 1602 distinct subjects over 2316 slots and 94
 * genres of which 10 were shared. Shown twenty at once it can see that six of
 * them are popular science and say so.
 *
 * The granularity instruction is the other half. Left to itself the model
 * writes the most specific true label ('Soviet-Era Drama'), which is accurate
 * and useless as a filter; a category is only worth a pill if several books
 * land on it.
 *
 * Results carry the index they answered for rather than being positional: a
 * model that drops or reorders an entry must not silently shift every book's
 * tags onto its neighbour.
 */
export async function categorizeBooksExternal(
  books: BookToCategorize[],
  vocabularies: Vocabularies = {},
): Promise<BookCategorization[]> {
  const list = books
    .map((book, index) => `${index}. '${book.title}' by ${book.authorName}`)
    .join('\n');

  const prompt =
    `Categorize these ${books.length} books:\n${list}\n\n` +
    `Return ONLY a JSON array with one object per book, each with "index" (the number above, so a book you cannot place can be omitted), ` +
    `"categories" (2-4 tags for the kind of book it is, like 'Popular Science', 'Memoir'), ` +
    `"themes" (3-5 deeper thematic tags like 'altruism & selfishness', 'units of selection'), ` +
    `and "moods" (2-4 reader mood/feel tags like 'Mind-expanding', 'Rigorous').` +
    ` Group the books: prefer tags broad enough that several of these books share one, name the kind of book rather than its specific subject matter, and do not use a tag that would apply to only one book in the list unless nothing broader is true of it.` +
    `${buildVocabularyClause(vocabularies)} Return ONLY valid JSON, no other text.`;

  // Scales with the batch: ~60 tokens of tags per book, plus room for the
  // vocabulary-heavy prompt to be echoed back by a model that over-explains.
  const maxTokens = Math.min(8192, 512 + books.length * 120);

  const parsed = await completeText<Partial<BookCategorization>[]>(prompt, {
    maxTokens,
    transform: (rawText) => parseJsonResponse<Partial<BookCategorization>[]>(rawText),
  });

  return (Array.isArray(parsed) ? parsed : [])
    .filter(
      (entry): entry is BookCategorization =>
        typeof entry?.index === 'number' && entry.index >= 0 && entry.index < books.length,
    )
    .map((entry) => ({
      index: entry.index,
      categories: entry.categories ?? [],
      themes: entry.themes ?? [],
      moods: entry.moods ?? [],
    }));
}
