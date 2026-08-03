import { firstAuthorSurname } from '../../../lib/books/first-author-surname';

describe('firstAuthorSurname', () => {
  it.each([
    ['Vinay Sitapati', 'Sitapati'],
    ['Tim Ferriss', 'Ferriss'],
    ['Homer', 'Homer'],
    ['  Larry   Collins  ', 'Collins'],
  ])('takes the surname from %s', (input, expected) => {
    expect(firstAuthorSurname(input)).toBe(expected);
  });

  // The forms that emptied a real import's rows: everything past the first
  // author is what Google refuses to match.
  it.each([
    ['Mortimer J. Adler and Charles Van Doren', 'Adler'],
    ['Larry Collins & Dominique Lapierre', 'Collins'],
    ['Susan Wise Bauer, Jessie Wise', 'Bauer'],
    ['Barnabas Kindersley with Anabel Kindersley', 'Kindersley'],
    ['50 Cent, Robert Greene', 'Cent'],
  ])('keeps only the first author in %s', (input, expected) => {
    expect(firstAuthorSurname(input)).toBe(expected);
  });

  // "Lastname, Firstname" needs no special case: the comma is a separator, so
  // the surname is already the first chunk.
  it.each([
    ['Sitapati, Vinay', 'Sitapati'],
    ['Adler, Mortimer J.', 'Adler'],
  ])('handles the inverted form %s', (input, expected) => {
    expect(firstAuthorSurname(input)).toBe(expected);
  });

  it.each([
    ['Martin Luther King Jr.', 'King'],
    ['Dale Carnegie III', 'Carnegie'],
    ['Oliver Sacks, MD', 'Sacks'],
  ])('walks back past the suffix in %s', (input, expected) => {
    expect(firstAuthorSurname(input)).toBe(expected);
  });

  it('skips a trailing initial rather than returning it', () => {
    expect(firstAuthorSurname('Adler M J')).toBe('Adler');
  });

  it.each([[null], [undefined], [''], ['   '], ['.']])('returns null for %p', (input) => {
    expect(firstAuthorSurname(input as string | null)).toBeNull();
  });

  /**
   * Both of these sent an import after the wrong person, and one of them put a
   * Clive Cussler novel in a library that had asked for Clive Gamble (LOS-205).
   */
  describe('names the wrong author would be taken from', () => {
    // Every chunk is already a surname, so the first is the one wanted --
    // taking the last asked Google about Irion and got a different Irion.
    it.each([
      ['Tyson/Liu/Irion', 'Tyson'],
      ['Woodward/Bernstein', 'Woodward'],
      ['Strunk | White', 'Strunk'],
    ])('takes the first of the slash-separated %s', (input, expected) => {
      expect(firstAuthorSurname(input)).toBe(expected);
    });

    // One surname shared by two people, written on the last of them. The first
    // chunk is a bare forename and names nobody on its own.
    it.each([
      ['Ingri and Edgar Parin d’Aulaire', 'd’Aulaire'],
      ['Jan and Stan Berenstain', 'Berenstain'],
    ])('does not take the bare forename from %s', (input, expected) => {
      expect(firstAuthorSurname(input)).toBe(expected);
    });

    // Still the first author where the first chunk is a whole name.
    it.each([
      ['Mortimer J. Adler and Charles Van Doren', 'Adler'],
      ['Clive Gamble', 'Gamble'],
    ])('keeps taking the first author from %s', (input, expected) => {
      expect(firstAuthorSurname(input)).toBe(expected);
    });
  });
});
