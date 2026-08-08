import { isValidEmail } from '../../../lib/validate/is-valid-email';

describe('isValidEmail', () => {
  it.each([
    'reader@example.com',
    'first.last@example.co.uk',
    'reader+tag@example.com',
    '  reader@example.com  ',
  ])('accepts %s', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it.each([
    ['no at sign', 'reader.example.com'],
    ['no domain dot', 'reader@example'],
    ['no local part', '@example.com'],
    ['spaces inside', 'read er@example.com'],
    ['empty', ''],
    ['whitespace only', '   '],
    ['trailing dot', 'reader@example.'],
  ])('rejects %s', (_label, value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['reader@example.com']])(
    'rejects the non-string %p',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );

  it('rejects an address longer than the column allows', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});
