import { validateDisplayName } from '../../../lib/validate/validate-display-name';

describe('validateDisplayName', () => {
  it('accepts a normal name', () => {
    expect(validateDisplayName('Ada Reader')).toBeNull();
  });

  it('rejects a missing or non-string name', () => {
    expect(validateDisplayName(undefined)).toBe('Display name is required.');
    expect(validateDisplayName(42)).toBe('Display name is required.');
  });

  it('rejects a whitespace-only name', () => {
    // Satisfies NOT NULL but leaves the reader blank everywhere it is shown.
    expect(validateDisplayName('   ')).toBe('Display name is required.');
  });

  it('measures length after trimming', () => {
    expect(validateDisplayName(`  ${'a'.repeat(255)}  `)).toBeNull();
    expect(validateDisplayName('a'.repeat(256))).toBe(
      'Display name must be at most 255 characters.',
    );
  });
});
