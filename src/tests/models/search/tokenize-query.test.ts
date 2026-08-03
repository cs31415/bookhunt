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
   * fn_match_import_rows scores each term as `title ILIKE '%term%'`, so a hyphen
   * kept inside a term has to appear in the stored title character for
   * character. "half-lion" scored nothing against a book catalogued as
   * "Half - Lion", so re-importing the reader's own file offered to add it a
   * second time (LOS-203).
   */
  describe('word separators the catalog disagrees about', () => {
    it.each([
      ['half-lion', ['half', 'lion']],
      ['well-trained mind', ['well', 'trained', 'mind']],
      ['spider-man', ['spider', 'man']],
      ['science/fiction', ['science', 'fiction']],
      ['bhagavad–gita', ['bhagavad', 'gita']],
      ['notre—dame', ['notre', 'dame']],
    ])('%s becomes %p', (input, expected) => {
      expect(tokenizeQuery(input)).toEqual(expected);
    });
  });

  // Matching how titles and publishers are tokenized for scoring, where
  // splitting a possessive yields a term that matches none of its spellings.
  it('keeps an apostrophe inside the word', () => {
    expect(tokenizeQuery("frommer's hong kong")).toEqual(["frommer's", 'hong', 'kong']);
  });
});
