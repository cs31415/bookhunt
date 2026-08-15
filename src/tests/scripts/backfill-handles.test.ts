// The script is plain CommonJS so it can run without a build step; requiring it
// is how the naming rules get tested. It exports the helpers and only runs main
// when invoked directly.
const { handleFromEmail, makeUnique } = require('../../../scripts/backfill-handles');

describe('handleFromEmail', () => {
  it('takes the local part and folds case', () => {
    expect(handleFromEmail('Ada.Reader@example.com')).toBe('ada_reader');
  });

  it('folds every disallowed character to a single underscore', () => {
    expect(handleFromEmail('ada..reader@example.com')).toBe('ada_reader');
    expect(handleFromEmail('ada-reader+books@example.com')).toBe('ada_reader_books');
  });

  it('strips leading and trailing underscores', () => {
    // A leading underscore is invalid, and a trailing one is just noise.
    expect(handleFromEmail('_ada_@example.com')).toBe('ada');
  });

  it('drops leading non-letters so the handle starts with a letter', () => {
    expect(handleFromEmail('92ada@example.com')).toBe('ada');
  });

  it('falls back to a usable name when nothing survives', () => {
    expect(handleFromEmail('42@example.com')).toBe('reader');
  });

  it('pads a name that is too short', () => {
    expect(handleFromEmail('jo@example.com')).toBe('jo0');
  });

  it('truncates a name that is too long', () => {
    const long = 'a'.repeat(60);
    expect(handleFromEmail(`${long}@example.com`)).toHaveLength(30);
  });
});

describe('makeUnique', () => {
  it('returns the base when it is free', () => {
    const taken = new Set<string>();
    expect(makeUnique('ada', taken)).toBe('ada');
    expect(taken.has('ada')).toBe(true);
  });

  it('suffixes on collision and keeps counting', () => {
    const taken = new Set(['ada']);
    expect(makeUnique('ada', taken)).toBe('ada2');
    expect(makeUnique('ada', taken)).toBe('ada3');
  });

  it('never returns a reserved handle', () => {
    const taken = new Set<string>();
    expect(makeUnique('search', taken)).toBe('search2');
  });

  it('trims the stem so a suffixed handle still fits the column', () => {
    const base = 'a'.repeat(30);
    const taken = new Set([base]);
    const result = makeUnique(base, taken);
    expect(result).toHaveLength(30);
    expect(result.endsWith('2')).toBe(true);
  });
});
