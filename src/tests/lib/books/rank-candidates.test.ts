import { pickBestCandidate, isEnglish } from '../../../lib/books/rank-candidates';
import { SearchResult } from '../../../lib/books/books-types';

function candidate(over: Partial<SearchResult>): SearchResult {
  return {
    googleBooksId: null,
    openLibraryId: null,
    title: 'The Psychology of Money',
    authors: ['Morgan Housel'],
    year: null,
    publisher: null,
    pages: null,
    rating: null,
    coverUrl: null,
    isbn13: null,
    language: 'en',
    ...over,
  } as SearchResult;
}

describe('pickBestCandidate', () => {
  /*
   * The bug this exists for (LOS-361). A Tamil edition credits Morgan Housel
   * exactly as well as the English one, so the old rule -- first candidate
   * crediting the author -- took whichever Google ranked first. Its title then
   * became the slug, putting the wrong edition in the URL.
   */
  it('prefers the English edition when the provider ranks the Tamil one first', () => {
    const tamil = candidate({ title: 'The Psychology of Money (Tamil)', language: 'ta' });
    const english = candidate({ title: 'The Psychology of Money', language: 'en' });

    const picked = pickBestCandidate([tamil, english], 'The Psychology of Money', 'morgan-housel');

    expect(picked).toBe(english);
  });

  // Two signals point the same way above. This isolates the title one, which is
  // the check that fixes the reported case without knowing about language.
  it('prefers the exact title over a parenthesised variant, language aside', () => {
    const variant = candidate({ title: 'The Psychology of Money (Tamil)', language: 'en' });
    const exact = candidate({ title: 'The Psychology of Money', language: 'en' });

    const picked = pickBestCandidate([variant, exact], 'The Psychology of Money', 'morgan-housel');

    expect(picked).toBe(exact);
  });

  // And this isolates language, with titles identical.
  it('prefers English when the titles are equally good', () => {
    const dutch = candidate({ language: 'nl' });
    const english = candidate({ language: 'en' });

    const picked = pickBestCandidate([dutch, english], 'The Psychology of Money', 'morgan-housel');

    expect(picked).toBe(english);
  });

  /*
   * Author outranks both, because a different author is a different book while
   * a differing title is usually the same book dressed differently.
   */
  it('takes the right author over a better title by the wrong one', () => {
    const impostor = candidate({ title: 'The Psychology of Money', authors: ['Someone Else'] });
    const real = candidate({ title: 'The Psychology of Money: Timeless Lessons' });

    const picked = pickBestCandidate([impostor, real], 'The Psychology of Money', 'morgan-housel');

    expect(picked).toBe(real);
  });

  // Language is a tiebreaker, not a filter: a genuinely foreign-language book
  // must still be reachable when nothing English matches.
  it('still returns a foreign edition when it is the only one', () => {
    const tamil = candidate({ title: 'The Psychology of Money (Tamil)', language: 'ta' });

    const picked = pickBestCandidate([tamil], 'The Psychology of Money', 'morgan-housel');

    expect(picked).toBe(tamil);
  });

  // Providers sometimes omit author metadata entirely; a 404 would be worse.
  it('falls back to the provider order when nothing scores', () => {
    const first = candidate({ title: 'Something Else', authors: [], language: 'de' });
    const second = candidate({ title: 'Another Thing', authors: [], language: 'fr' });

    expect(pickBestCandidate([first, second], 'The Psychology of Money', 'morgan-housel')).toBe(first);
  });

  it('returns null for no candidates', () => {
    expect(pickBestCandidate([], 'anything', 'someone')).toBeNull();
  });

  // Ties keep the provider's order: it knows things this does not.
  it('leaves equally scored candidates in the order given', () => {
    const a = candidate({ googleBooksId: 'a' });
    const b = candidate({ googleBooksId: 'b' });

    expect(pickBestCandidate([a, b], 'The Psychology of Money', 'morgan-housel')).toBe(a);
  });
});

/*
 * books.language holds both forms -- 251 rows say "en" and 114 say "English" --
 * because the column defaulted to 'English' before providers began writing ISO
 * codes. A check comparing against 'en' alone would treat those 114 as foreign.
 */
describe('isEnglish', () => {
  it.each(['en', 'eng', 'English', 'ENGLISH', 'en-GB', 'en-US'])('accepts %s', (value) => {
    expect(isEnglish(value)).toBe(true);
  });

  it.each(['ta', 'nl', 'zh-CN', 'Tamil', '', null, undefined])('rejects %s', (value) => {
    expect(isEnglish(value as string | null)).toBe(false);
  });
});
