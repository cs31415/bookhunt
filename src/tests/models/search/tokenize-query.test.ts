import { tokenizeQuery } from '../../../models/search/tokenize-query';

describe('tokenizeQuery', () => {
  it('splits on whitespace and commas', () => {
    expect(tokenizeQuery('dune messiah, children')).toEqual(['dune', 'messiah', 'children']);
  });

  it('drops words too common to narrow anything', () => {
    expect(tokenizeQuery('the best books about the sea')).toEqual(['sea']);
  });

  // Otherwise a query of nothing but stop words asks the catalog for nothing.
  it('searches for the stop words themselves when that is all there is', () => {
    expect(tokenizeQuery('the book')).toEqual(['the', 'book']);
  });

  /**
   * fn_match_import_rows scores each term as `title ILIKE '%term%'`, so
   * punctuation kept inside a term has to appear in the stored title character
   * for character. Both of these came from a reader re-importing their own file
   * and being offered a book they already owned (LOS-203):
   *
   *   "half-lion"     vs a book catalogued as "Half - Lion"
   *   "celebrations!" vs a book catalogued as "Celebrations"
   */
  describe('punctuation the catalog disagrees about', () => {
    it.each([
      ['half-lion', ['half', 'lion']],
      ['celebrations!', ['celebrations']],
      ['who moved my cheese?', ['who', 'moved', 'cheese']],
      ['well-trained mind', ['well', 'trained', 'mind']],
      ['spider-man', ['spider', 'man']],
      ['science/fiction', ['science', 'fiction']],
      ['bhagavad–gita', ['bhagavad', 'gita']],
      ['dune: part two', ['dune', 'part', 'two']],
      ['norwegian wood (vintage)', ['norwegian', 'wood', 'vintage']],
      ['the "real" story', ['real', 'story']],
    ])('%s becomes %p', (input, expected) => {
      expect(tokenizeQuery(input)).toEqual(expected);
    });

    it('keeps non-ASCII letters, which are not punctuation', () => {
      expect(tokenizeQuery('niños como yo')).toEqual(['niños', 'como', 'yo']);
    });
  });

  // Matching how titles and publishers are tokenized for scoring, where
  // splitting a possessive yields a term that matches none of its spellings.
  it('keeps an apostrophe inside the word', () => {
    expect(tokenizeQuery("frommer's hong kong")).toEqual(["frommer's", 'hong', 'kong']);
  });
});
