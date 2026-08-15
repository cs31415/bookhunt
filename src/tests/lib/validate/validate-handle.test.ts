import { validateHandle } from '../../../lib/validate/validate-handle';
import { normalizeHandle } from '../../../lib/validate/normalize-handle';

describe('validateHandle', () => {
  it('accepts a normal handle', () => {
    expect(validateHandle('ada')).toBeNull();
    expect(validateHandle('ada_reader_92')).toBeNull();
  });

  it('rejects a missing or non-string handle', () => {
    expect(validateHandle(undefined)).toBe('Handle is required.');
    expect(validateHandle(42)).toBe('Handle is required.');
    expect(validateHandle('   ')).toBe('Handle is required.');
  });

  it('enforces the length bounds', () => {
    expect(validateHandle('ab')).toBe('Handle must be between 3 and 30 characters.');
    expect(validateHandle('a'.repeat(30))).toBeNull();
    expect(validateHandle('a'.repeat(31))).toBe(
      'Handle must be between 3 and 30 characters.',
    );
  });

  it('rejects a handle that does not start with a letter', () => {
    // A bare number at the root of the site reads as a database id, not a person.
    expect(validateHandle('42reader')).toBe('Handle must start with a letter.');
    expect(validateHandle('_ada')).toBe('Handle must start with a letter.');
  });

  it('rejects characters outside letters, numbers and underscore', () => {
    const message = 'Handle can contain only letters, numbers and underscores.';
    expect(validateHandle('ada reader')).toBe(message);
    expect(validateHandle('ada-reader')).toBe(message);
    expect(validateHandle('ada.reader')).toBe(message);
    expect(validateHandle('ada@reader')).toBe(message);
  });

  it('rejects a reserved handle', () => {
    expect(validateHandle('search')).toBe('That handle is reserved.');
    expect(validateHandle('settings')).toBe('That handle is reserved.');
    expect(validateHandle('messages')).toBe('That handle is reserved.');
  });

  it('judges a handle by its normalized form', () => {
    // Uppercase is folded away rather than refused, so "Ada" signs up as @ada
    // instead of being told its own name is invalid.
    expect(validateHandle(normalizeHandle('Ada'))).toBeNull();
    expect(validateHandle(normalizeHandle('  SEARCH  '))).toBe('That handle is reserved.');
  });
});

describe('normalizeHandle', () => {
  it('trims and folds case', () => {
    expect(normalizeHandle('  Ada_Reader  ')).toBe('ada_reader');
  });
});
