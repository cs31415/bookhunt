import {
  findUserByEmail,
  registerUser,
  setResetToken,
  resetPassword,
  verifyEmail,
  setVerificationToken,
} from '../../data/auth-data';
import { pool } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = (pool as any).query as jest.Mock;

describe('auth-data', () => {
  describe('findUserByEmail', () => {
    it('returns the user row when found', async () => {
      const row = { id: 1, email: 'a@b.com' };
      mockQuery.mockResolvedValue({ rows: [row] });
      const result = await findUserByEmail('a@b.com');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_find_user_by_email($1)',
        ['a@b.com'],
      );
      expect(result).toEqual(row);
    });

    it('returns null when no user is found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await findUserByEmail('missing@b.com');
      expect(result).toBeNull();
    });
  });

  describe('registerUser', () => {
    it('calls fn_register_user with correct args and returns the row', async () => {
      const row = { id: 2, email: 'new@b.com' };
      mockQuery.mockResolvedValue({ rows: [row] });
      const expiry = new Date('2026-01-02T12:00:00Z');
      const result = await registerUser('new@b.com', 'hash', 'Bob', 'bob', 'verify-tok', expiry);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_register_user($1, $2, $3, $4, $5, $6)',
        ['new@b.com', 'hash', 'Bob', 'bob', 'verify-tok', expiry],
      );
      expect(result).toEqual(row);
    });
  });

  describe('verifyEmail', () => {
    it('returns the verified user row', async () => {
      const row = { id: 3, email: 'a@b.com', display_name: 'Alice' };
      mockQuery.mockResolvedValue({ rows: [row] });
      const result = await verifyEmail('tok123');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM fn_verify_email($1)', ['tok123']);
      expect(result).toEqual(row);
    });

    it('returns null when the token matched nothing', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await expect(verifyEmail('expired')).resolves.toBeNull();
    });
  });

  describe('setVerificationToken', () => {
    it('calls fn_set_verification_token with email, token, and expiry', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const expiry = new Date('2026-01-01T12:00:00Z');
      await setVerificationToken('a@b.com', 'tok123', expiry);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_set_verification_token($1, $2, $3)',
        ['a@b.com', 'tok123', expiry],
      );
    });
  });

  describe('setResetToken', () => {
    it('calls fn_set_reset_token with email, token, and expiry', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const expiry = new Date('2026-01-01T12:00:00Z');
      await setResetToken('a@b.com', 'tok123', expiry);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_set_reset_token($1, $2, $3)',
        ['a@b.com', 'tok123', expiry],
      );
    });
  });

  describe('resetPassword', () => {
    it('returns true when the stored procedure returns true', async () => {
      mockQuery.mockResolvedValue({ rows: [{ fn_reset_password: true }] });
      const result = await resetPassword('tok', 'newHash');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_reset_password($1, $2)',
        ['tok', 'newHash'],
      );
      expect(result).toBe(true);
    });

    it('returns false when the stored procedure returns false', async () => {
      mockQuery.mockResolvedValue({ rows: [{ fn_reset_password: false }] });
      const result = await resetPassword('expired', 'hash');
      expect(result).toBe(false);
    });
  });
});
