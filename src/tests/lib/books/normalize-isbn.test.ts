import { isSameIsbn, normalizeIsbn } from '../../../lib/books/normalize-isbn';

describe('normalizeIsbn', () => {
  it.each([
    ['9780441013593', '9780441013593'],
    ['978-0-441-01359-3', '9780441013593'],
    ['978 0 441 01359 3', '9780441013593'],
    ['  9780441013593  ', '9780441013593'],
    ['0441013597', '0441013597'],
    ['043942089X', '043942089X'],
    ['043942089x', '043942089X'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeIsbn(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['not an isbn'],
    ['12345'],
    ['97804410135931234'],
    ['04X9420891'], // X anywhere but the check digit
    ['978044101359X'], // 13-digit ISBNs have no X check digit
  ])('rejects %o', (input) => {
    expect(normalizeIsbn(input as string)).toBeNull();
  });
});

describe('isSameIsbn', () => {
  it('matches identical ISBNs regardless of punctuation', () => {
    expect(isSameIsbn('978-0-441-01359-3', '9780441013593')).toBe(true);
  });

  // CSV exports commonly carry ISBN-10 while providers return ISBN-13.
  it('matches an ISBN-10 against its ISBN-13 form', () => {
    expect(isSameIsbn('0441013597', '9780441013593')).toBe(true);
    expect(isSameIsbn('9780441013593', '0441013597')).toBe(true);
  });

  it('does not match different books', () => {
    expect(isSameIsbn('9780441013593', '9780547928227')).toBe(false);
  });

  it('does not match a 979-prefixed ISBN-13 against any ISBN-10', () => {
    // 979 has no ISBN-10 equivalent, so a middle-digit comparison would be bogus.
    expect(isSameIsbn('9790441013593', '0441013597')).toBe(false);
  });

  it('is false when either side is missing or unparseable', () => {
    expect(isSameIsbn(null, '9780441013593')).toBe(false);
    expect(isSameIsbn('9780441013593', undefined)).toBe(false);
    expect(isSameIsbn('nonsense', '9780441013593')).toBe(false);
  });
});
