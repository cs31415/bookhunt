import { matchesTitleAndAuthor } from '../../../models/upload/matches-detected-book';

const cosmos = { title: 'Cosmos', authors: ['Carl Sagan'], publishers: ['Random House'] };

describe('matchesTitleAndAuthor', () => {
  it('matches when both the title and the author agree', () => {
    expect(matchesTitleAndAuthor(cosmos, { title: 'Cosmos', author: 'Carl Sagan' })).toBe(true);
  });

  it('ignores the publisher entirely, including a contradicting one', () => {
    expect(
      matchesTitleAndAuthor(cosmos, {
        title: 'Cosmos',
        author: 'Carl Sagan',
        publisher: 'Ballantine Books',
      }),
    ).toBe(true);
  });

  it('tolerates a subtitle the file left off', () => {
    expect(
      matchesTitleAndAuthor(
        { title: 'Sapiens: A Brief History of Humankind', authors: ['Yuval Noah Harari'] },
        { title: 'Sapiens', author: 'Yuval Noah Harari' },
      ),
    ).toBe(true);
  });

  it('matches a partial author name, as files abbreviate them', () => {
    expect(
      matchesTitleAndAuthor(
        { title: 'Six Easy Pieces', authors: ['Richard Phillips Feynman'] },
        { title: 'Six Easy Pieces', author: 'Richard P. Feynman' },
      ),
    ).toBe(true);
  });

  // Unlike matchesDetectedBook, which treats a missing author as matching
  // because a photographed spine often has none, absence here is not
  // confirmation — the caller is asking whether the author identifies the book.
  it('does not match when the hint names no author', () => {
    expect(matchesTitleAndAuthor(cosmos, { title: 'Cosmos' })).toBe(false);
  });

  it('does not match when the candidate lists no authors', () => {
    expect(
      matchesTitleAndAuthor(
        { title: 'Cosmos', authors: [] },
        { title: 'Cosmos', author: 'Carl Sagan' },
      ),
    ).toBe(false);
  });

  it('does not match a different author of the same title', () => {
    expect(matchesTitleAndAuthor(cosmos, { title: 'Cosmos', author: 'Ann Druyan' })).toBe(false);
  });

  it('does not match when the titles barely overlap', () => {
    expect(
      matchesTitleAndAuthor(
        { title: 'Chronicle', authors: ['Haruki Murakami'] },
        { title: 'The Wind-Up Bird Chronicle', author: 'Haruki Murakami' },
      ),
    ).toBe(false);
  });
});
