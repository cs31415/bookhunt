import { completeTextWithModel } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { cacheGet } from '../../lib/cache/cache-get';
import { cacheSet } from '../../lib/cache/cache-set';
import { cacheKey } from '../../lib/cache/cache-key';
import { getTagVocabulary } from '../../data/ai-data';
import { buildVocabularyClause } from './build-vocabulary-clause';
import { SearchResult } from './search';

/**
 * Bump when the prompt below changes — that is how old answers get retired,
 * since nothing purges keys.
 */
const CACHE_VERSION = 2;

/** Matches generate-themes: enough to find a fit without crowding the query. */
const VOCABULARY_LIMIT = 150;

/** Suggestions for a given phrasing do not go stale in any meaningful way. */
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Folds "Carl Sagan", "carl sagan " and "Carl  Sagan" onto one entry. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function searchBooksWithLlm(
  query: string,
  limit: number,
  seedCategory?: string,
  seedMood?: string,
): Promise<SearchResult[]> {
  const maxResults = Math.min(Math.max(1, limit), 20);
  const seedClauses = [
    seedCategory
      ? `Every book's "categories" array must include "${seedCategory}" verbatim, alongside 1-3 other genre tags.`
      : null,
    seedMood
      ? `Every book's "moods" array must include "${seedMood}" verbatim, alongside 1-3 other mood tags.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  // Keyed on the caller's own inputs, so two callers only share an answer when
  // they asked the same question. The catalog vocabulary also goes into the
  // prompt but is deliberately left out of the key: it shifts every time a book
  // is tagged, so keying on it would miss the cache almost every call to chase
  // a difference that only nudges tag wording. The cost is that a cached answer
  // may carry tags from an older vocabulary, which the next categorization of
  // those books corrects anyway. Bump CACHE_VERSION to retire them wholesale.
  //
  // The result cached here is the pure LLM answer -- library matching happens
  // per user, in the controller, outside this function, and caching it would
  // leak one shelf into another.
  const key = cacheKey('ai:search', CACHE_VERSION, normalizeQuery(query), maxResults, seedCategory, seedMood);
  const cached = await cacheGet<SearchResult[]>(key);
  if (cached) return cached;

  // After the cache check, so a hit never pays for the lookups.
  const [categories, moods] = await Promise.all([
    getTagVocabulary('subjects', VOCABULARY_LIMIT),
    getTagVocabulary('moods', VOCABULARY_LIMIT),
  ]);

  const prompt = `Suggest up to ${maxResults} books that best match this search: "${query.trim()}". Return ONLY a JSON array of objects with "title", "author" (can be null if unknown), "categories" (2-4 genre tags like 'Popular Science', 'Memoir'), and "moods" (2-4 reader mood/feel tags like 'Mind-expanding', 'Rigorous') fields.${seedClauses ? ` ${seedClauses}` : ''}${buildVocabularyClause({ categories, moods })} Return ONLY valid JSON, no other text.`;

  try {
    const { result: suggestions, model } = await completeTextWithModel(prompt, {
      maxTokens: 2048,
      transform: (rawText) =>
        parseJsonResponse<{ title: string; author: string | null; categories?: string[]; moods?: string[] }[]>(
          rawText,
        ),
    });

    const results = suggestions
      .filter((s) => s && s.title)
      .map((s) => ({
        googleBooksId: null,
        openLibraryId: null,
        title: s.title,
        authors: s.author ? [s.author] : [],
        year: null,
        publisher: null,
        pages: null,
        rating: null,
        coverUrl: null,
        isbn13: null,
        language: null,
        blurb: null,
        categories: s.categories ?? [],
        moods: s.moods ?? [],
        inLibrary: false,
        libraryStatus: null,
        source: model.model,
      }));

    // Only a real answer is worth keeping. An empty one means the model gave us
    // nothing usable, and storing that would serve the failure for 30 days.
    if (results.length > 0) await cacheSet(key, results, CACHE_TTL_SECONDS);

    return results;
  } catch (error) {
    console.error('[llm] search failed, caller should fall back:', error);
    return [];
  }
}
