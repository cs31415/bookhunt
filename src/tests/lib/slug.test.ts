import { deslugify, slugifyName, authorSlugMatches } from '../../lib/slug';

describe('slug utils', () => {
  describe('slugifyName', () => {
    it('lowercases, collapses non-alphanumerics, and trims dashes', () => {
      expect(slugifyName('Ayn Rand')).toBe('ayn-rand');
      expect(slugifyName("Madeleine L'Engle")).toBe('madeleine-l-engle');
      expect(slugifyName('  J.R.R. Tolkien  ')).toBe('j-r-r-tolkien');
    });
  });

  describe('deslugify', () => {
    it('turns dashes back into spaces', () => {
      expect(deslugify('ayn-rand')).toBe('ayn rand');
    });
  });

  describe('authorSlugMatches', () => {
    it('matches when every wanted token is present in the candidate', () => {
      expect(authorSlugMatches('ayn-rand', 'ayn-rand')).toBe(true);
      // Extra credits on the candidate (translator, "with ...") still match.
      expect(authorSlugMatches('ayn-rand-with-leonard-peikoff', 'ayn-rand')).toBe(true);
    });

    it('rejects a different author', () => {
      expect(authorSlugMatches('myles-birket-foster', 'ayn-rand')).toBe(false);
      // A partial candidate missing a wanted token does not match.
      expect(authorSlugMatches('rand', 'ayn-rand')).toBe(false);
    });

    it('returns false for empty inputs', () => {
      expect(authorSlugMatches('', 'ayn-rand')).toBe(false);
      expect(authorSlugMatches('ayn-rand', '')).toBe(false);
    });
  });
});
