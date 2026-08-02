import { bareQueryTerm } from '../../../lib/books/bare-query-term';

describe('bareQueryTerm', () => {
  it.each([
    ['Half Lion', 'Half Lion'],
    ['The "Real" Story', 'The Real Story'],
    ['Dune: Part Two', 'Dune Part Two'],
    ['Norwegian Wood (Vintage)', 'Norwegian Wood Vintage'],
    ['  Half   Lion  ', 'Half Lion'],
    ['Mortimer J. Adler and Charles Van Doren', 'Mortimer J. Adler and Charles Van Doren'],
  ])('flattens %s', (input, expected) => {
    expect(bareQueryTerm(input)).toBe(expected);
  });

  // A colon left in place would be read as a qualifier by Google Books, turning
  // the rest of the title into that qualifier's argument.
  it('leaves no colon for Google Books to read as a qualifier', () => {
    expect(bareQueryTerm('Sapiens: A Brief History')).not.toContain(':');
  });
});
