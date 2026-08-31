import { updateProfile } from '../../../models/users/update-profile';
import { updateUserProfile } from '../../../data/users-data';

jest.mock('../../../data/users-data');

const mockUpdate = updateUserProfile as jest.Mock;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'a@b.co',
    display_name: 'Ada',
    handle: 'ada',
    is_discoverable: false,
    share_reviews: false,
    preferences: {},
    ...overrides,
  };
}

describe('updateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(row());
  });

  /*
   * A boolean cannot say "unchanged" on its own, so each one travels with a
   * companion flag saying whether the caller meant to set it. Without that,
   * false and absent are the same value -- and false is exactly what takes a
   * published review back down again (LOS-266).
   */
  it('does not touch shareReviews when the caller left it out', async () => {
    await updateProfile(1, { displayName: 'Ada' });

    const args = mockUpdate.mock.calls[0];
    expect(args[5]).toBeNull(); // shareReviews
    expect(args[6]).toBe(false); // setShareReviews
  });

  it('sets it when the caller asked for true', async () => {
    await updateProfile(1, { shareReviews: true });

    const args = mockUpdate.mock.calls[0];
    expect(args[5]).toBe(true);
    expect(args[6]).toBe(true);
  });

  // The case the companion flag exists for.
  it('sets it when the caller asked for false', async () => {
    await updateProfile(1, { shareReviews: false });

    const args = mockUpdate.mock.calls[0];
    expect(args[5]).toBe(false);
    expect(args[6]).toBe(true);
  });

  it('reports the stored value back', async () => {
    mockUpdate.mockResolvedValue(row({ share_reviews: true }));

    const profile = await updateProfile(1, { shareReviews: true });

    expect(profile?.shareReviews).toBe(true);
  });

  it('is false for a reader who has never chosen', async () => {
    const profile = await updateProfile(1, { displayName: 'Ada' });

    expect(profile?.shareReviews).toBe(false);
  });
});
