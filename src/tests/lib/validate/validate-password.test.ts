import { MIN_PASSWORD_LENGTH, validatePassword } from '../../../lib/validate/validate-password';

describe('validatePassword', () => {
  it('accepts a password at the minimum length', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('reports a missing password rather than throwing', () => {
    // The bug this closes: undefined used to reach bcrypt.hash and surface as a
    // 500 instead of a 400.
    expect(validatePassword(undefined)).toBe('Password is required.');
    expect(validatePassword('')).toBe('Password is required.');
    expect(validatePassword(12345678)).toBe('Password is required.');
  });

  it('rejects a password one character short', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  });

  it('rejects a password past the bcrypt truncation point', () => {
    // Beyond 72 bytes bcrypt ignores the rest, so two different passwords would
    // open the same account.
    expect(validatePassword('a'.repeat(73))).toBe('Password must be at most 72 characters.');
    expect(validatePassword('a'.repeat(72))).toBeNull();
  });
});
