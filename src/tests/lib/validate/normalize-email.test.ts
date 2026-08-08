import { normalizeEmail } from '../../../lib/validate/normalize-email';

describe('normalizeEmail', () => {
  it('lowercases the address', () => {
    expect(normalizeEmail('Reader@Example.COM')).toBe('reader@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEmail('  reader@example.com \n')).toBe('reader@example.com');
  });

  it('collapses addresses that differ only in case to one value', () => {
    expect(normalizeEmail('A@b.com')).toBe(normalizeEmail('a@B.com'));
  });
});
