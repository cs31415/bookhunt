import { containsAbusiveContent } from '../../../lib/moderation/contains-abusive-content';
import { normalizeForMatching } from '../../../lib/moderation/normalize-text';

describe('containsAbusiveContent', () => {
  it('catches a banned term', () => {
    expect(containsAbusiveContent('you should kill yourself')).toBe(true);
    expect(containsAbusiveContent('kys')).toBe(true);
  });

  describe('evasions', () => {
    it.each([
      ['leetspeak', 'ky5'],
      ['padded letters', 'k y s'],
      ['punctuation between letters', 'k.y.s'],
      ['repeated characters', 'kyyyys'],
      ['case', 'KYS'],
      ['diacritics', 'kýs'],
      ['a mix of all of them', 'K.Ý.5'],
    ])('catches %s', (_label, text) => {
      expect(containsAbusiveContent(text)).toBe(true);
    });
  });

  describe('false positives — the failure mode that matters most', () => {
    it.each([
      // The canonical case. A substring match refuses a real English town.
      ['Scunthorpe', 'I grew up near Scunthorpe'],
      ['a word containing a term', 'that is a classic slurry of ideas'],
      ['therapist', 'my therapist recommended this one'],
      ['an ordinary sentence', 'Have you read Cosmos? I loved it.'],
      ['a title that looks alarming', 'I am reading The Killing Joke'],
      ['single letters that are not a word', 'a b c is how it starts'],
    ])('leaves %s alone', (_label, text) => {
      expect(containsAbusiveContent(text)).toBe(false);
    });
  });

  it('does not flag an empty message', () => {
    expect(containsAbusiveContent('')).toBe(false);
    expect(containsAbusiveContent('   ')).toBe(false);
  });
});

describe('normalizeForMatching', () => {
  it('folds case, accents and leetspeak', () => {
    expect(normalizeForMatching('Ádàm 1S h3re')).toBe('adam is here');
  });

  it('collapses repeats to a single character', () => {
    // "bok" looks wrong out of context, but the word list is folded through
    // this same function, so both sides land on the same string.
    expect(normalizeForMatching('booook')).toBe('bok');
    expect(normalizeForMatching('book')).toBe('bok');
  });

  it('rejoins letters spaced out to evade a match', () => {
    expect(normalizeForMatching('s l u r')).toBe('slur');
  });

  it('leaves a short run of separate words alone', () => {
    expect(normalizeForMatching('a b')).toBe('a b');
  });
});
