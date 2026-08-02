import { bareQueryTerm } from '../../../lib/books/bare-query-term';

describe('bareQueryTerm', () => {
  it.each([
    ['Half Lion', 'Half Lion'],
    ['The "Real" Story', 'The Real Story'],
    ['Dune: Part Two', 'Dune Part Two'],
    ['Norwegian Wood (Vintage)', 'Norwegian Wood Vintage'],
    ['  Half   Lion  ', 'Half Lion'],
    ['Science & Invention', 'Science Invention'],
  ])('flattens %s', (input, expected) => {
    expect(bareQueryTerm(input)).toBe(expected);
  });

  // The mark that emptied intitle:"Celebrations!" against Google's index.
  it('drops trailing punctuation that a quoted intitle would match literally', () => {
    expect(bareQueryTerm('Celebrations!')).toBe('Celebrations');
  });

  // Google reads a colon as the start of a qualifier, so an unquoted
  // "Dune: Part Two" searches for "Dune" under a field named "Dune".
  it('leaves no colon for Google Books to read as a qualifier', () => {
    expect(bareQueryTerm('Sapiens: A Brief History')).not.toContain(':');
  });

  // These sit inside words rather than between them; splitting on them matches
  // the phrase less well, not more.
  it.each([
    ["D'Aulaires' Book of Greek Myths", "D'Aulaires' Book of Greek Myths"],
    ['The Well-Trained Mind', 'The Well-Trained Mind'],
  ])('keeps the apostrophes and hyphens in %s', (input, expected) => {
    expect(bareQueryTerm(input)).toBe(expected);
  });

  it('keeps non-ASCII letters', () => {
    expect(bareQueryTerm('Niños como yo')).toBe('Niños como yo');
  });
});
