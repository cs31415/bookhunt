import {
  matchesTitleAndAuthor,
  matchesTitleAndAuthorIgnoringSubtitle,
} from '../../../models/matching/match-book-candidate';

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

describe('matchesTitleAndAuthorIgnoringSubtitle', () => {
  // The case the one-way test gets wrong: an LLM answers with the full
  // subtitle, the catalog holds the short title.
  it('matches when the subtitle is on the hint rather than the candidate', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: "Broca's Brain", authors: ['Carl Sagan'] },
        { title: "Broca's Brain: Reflections on the Romance of Science", author: 'Carl Sagan' },
      ),
    ).toBe(true);
  });

  it('still matches when the subtitle is on the candidate', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Sapiens: A Brief History of Humankind', authors: ['Yuval Noah Harari'] },
        { title: 'Sapiens', author: 'Yuval Noah Harari' },
      ),
    ).toBe(true);
  });

  it('does not match a different author, whichever side is longer', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Cosmos', authors: ['Carl Sagan'] },
        { title: 'Cosmos and Psyche: Intimations of a New World View', author: 'Richard Tarnas' },
      ),
    ).toBe(false);
  });

  it('does not match unrelated titles by the same author', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'The Dragons of Eden', authors: ['Carl Sagan'] },
        { title: 'The Demon-Haunted World', author: 'Carl Sagan' },
      ),
    ).toBe(false);
  });

  it('still requires an author on both sides', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle({ title: 'Cosmos', authors: ['Carl Sagan'] }, { title: 'Cosmos' }),
    ).toBe(false);
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Cosmos', authors: [] },
        { title: 'Cosmos', author: 'Carl Sagan' },
      ),
    ).toBe(false);
  });

  // Containment is not agreement. Without a delimiter the extra words are the
  // title, so the shared author cannot make these one book.
  it('rejects a short title merely contained in a longer one by the same author', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Chronicle', authors: ['Haruki Murakami'] },
        { title: 'The Wind-Up Bird Chronicle', author: 'Haruki Murakami' },
      ),
    ).toBe(false);
  });

  // LOS-275: what the reader saw. A library of the Foundation series was
  // reported as holding "Foundation" itself.
  it.each([
    ['Second Foundation'],
    ['Foundation and Empire'],
    ["Foundation's Edge"],
    ["The Complete Isaac Asimov's Foundation Series Books 1-7"],
  ])('does not read %s as Foundation', (owned) => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: owned, authors: ['Isaac Asimov'] },
        { title: 'Foundation', author: 'Isaac Asimov' },
      ),
    ).toBe(false);
  });

  it('matches the same book on both sides', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Second Foundation', authors: ['Isaac Asimov'] },
        { title: 'Second Foundation', author: 'Isaac Asimov' },
      ),
    ).toBe(true);
  });

  // A series and volume in a trailing parenthetical is the LLM's habit and the
  // catalog's alike, and says nothing about which book it is.
  it('sets aside a trailing parenthetical', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Dune (Dune Chronicles, Book 1)', authors: ['Frank Herbert'] },
        { title: 'Dune', author: 'Frank Herbert' },
      ),
    ).toBe(true);
  });

  // Why only one side may be stripped: a series prefix puts the distinguishing
  // words after the colon, so dropping both subtitles fuses two books.
  it('does not fuse two books sharing a series prefix', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: 'Star Wars: Darth Bane', authors: ['Drew Karpyshyn'] },
        { title: 'Star Wars: Heir to the Empire', author: 'Timothy Zahn' },
      ),
    ).toBe(false);
  });

  // Editions that differ by a word, which the bidirectional test has to tolerate
  // — 3 of 4 tokens each way.
  it('matches two spellings of one title', () => {
    expect(
      matchesTitleAndAuthorIgnoringSubtitle(
        { title: "Harry Potter and the Sorcerer's Stone", authors: ['J.K. Rowling'] },
        { title: "Harry Potter and the Philosopher's Stone", author: 'J.K. Rowling' },
      ),
    ).toBe(true);
  });
});
