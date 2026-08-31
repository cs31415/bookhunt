import { setReviewSharing } from '../../../models/library/set-review-sharing';
import { setLibraryReviewSharing } from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockSet = setLibraryReviewSharing as jest.Mock;

describe('setReviewSharing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue({ user_id: 1, book_id: 2, share_review: null });
  });

  it('publishes one review', async () => {
    await setReviewSharing(1, 2, true);
    expect(mockSet).toHaveBeenCalledWith(1, 2, true);
  });

  it('holds one back', async () => {
    await setReviewSharing(1, 2, false);
    expect(mockSet).toHaveBeenCalledWith(1, 2, false);
  });

  /*
   * The whole reason this is not a parameter on fn_update_library_entry. Null
   * here means "follow the global setting from now on" -- a value, not an
   * absence -- and it has to reach the column as null rather than being
   * coalesced into "unchanged" on the way (LOS-266).
   */
  it('passes null through, because null is a state and not an absence', async () => {
    await setReviewSharing(1, 2, null);
    expect(mockSet).toHaveBeenCalledWith(1, 2, null);
  });

  it('returns null when the reader does not own the book', async () => {
    mockSet.mockResolvedValue(null);
    expect(await setReviewSharing(1, 999, true)).toBeNull();
  });
});
