import { dedupeEditions } from '../../../models/authors/dedupe-editions';

import type { EditionLike } from '../../../models/authors/dedupe-editions';

function work(title: string, year: number | null, extra: Partial<EditionLike> = {}): EditionLike {
  return { title, year, ...extra };
}

describe('dedupeEditions', () => {
  it('keeps the most recent of several editions', () => {
    // The real case: five Snow Crash records from the provider, one book.
    const result = dedupeEditions([
      work('Snow Crash', 1992),
      work('Snow Crash', 2000),
      work('Snow Crash', 2022),
      work('Snow Crash', 2003),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2022);
  });

  it('keeps the edition the reader owns, even when an older one', () => {
    // Recency loses to ownership on purpose: dropping the owned edition would
    // take the reader's own book off the page and lose its library mark.
    const result = dedupeEditions([
      work('Snow Crash', 2022),
      work('Snow Crash', 1992, { inLibrary: true }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ year: 1992, inLibrary: true });
  });

  it('breaks a tie on year with the cataloged row', () => {
    // Both Seveneves records are 2015. The cataloged one has a slug and links
    // to a real page.
    const result = dedupeEditions([
      work('Seveneves', 2015),
      work('Seveneves', 2015, { bookId: 7 }),
    ]);

    expect(result[0].bookId).toBe(7);
  });

  it('groups on case and whitespace only', () => {
    const result = dedupeEditions([
      work('The  Diamond   Age', 1996),
      work('the diamond age', 2003),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2003);
  });

  it('leaves a differently titled record alone', () => {
    // "Cryptonomicon 8c" may well be the same book, but the record does not
    // say so, and merging two genuinely different titles is worse than one
    // extra row.
    const result = dedupeEditions([
      work('Cryptonomicon', 2012),
      work('Cryptonomicon 8c', 1999),
    ]);

    expect(result).toHaveLength(2);
  });

  it('keeps an edition with no year when it is the only one', () => {
    const result = dedupeEditions([work('Zodiac', null)]);
    expect(result).toHaveLength(1);
  });

  it('prefers a dated edition over an undated one', () => {
    const result = dedupeEditions([work('Reamde', null), work('Reamde', 2011)]);
    expect(result[0].year).toBe(2011);
  });

  it('preserves input order of the survivors, so callers can still sort', () => {
    const result = dedupeEditions([
      work('Anathem', 2009),
      work('Snow Crash', 1992),
      work('Snow Crash', 2022),
      work('Zodiac', 2007),
    ]);

    expect(result.map((w) => w.title)).toEqual(['Anathem', 'Snow Crash', 'Zodiac']);
  });

  it('returns an empty list unchanged', () => {
    expect(dedupeEditions([])).toEqual([]);
  });
});
