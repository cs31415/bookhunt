import { updateEntry } from '../../../models/library/update-entry';
import { updateLibraryEntry } from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockUpdate = updateLibraryEntry as jest.Mock;

describe('updateEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({ user_id: 1, book_id: 2, review: 'text' });
  });

  /*
   * The argument list is positional, and LOS-266 took one out of the middle of
   * it: `notes` and `review` were two columns, only one of which was ever
   * written, and they are now one. A test that only checked the return value
   * would pass while the review went into the slot that used to be notes.
   */
  it('passes the review in the position the data layer expects', async () => {
    await updateEntry(1, 2, { status: 'finished', userRating: 5, review: 'Worth the reread.' });

    expect(mockUpdate).toHaveBeenCalledWith(1, 2, 'finished', 5, 'Worth the reread.');
  });

  it('sends null for anything the caller left out', async () => {
    await updateEntry(1, 2, { review: 'Only the review.' });

    expect(mockUpdate).toHaveBeenCalledWith(1, 2, null, null, 'Only the review.');
  });

  // NULL means "leave it alone" in fn_update_library_entry's COALESCE, so an
  // absent review must not be confused with one being cleared.
  it('sends null for an absent review, not an empty string', async () => {
    await updateEntry(1, 2, { status: 'reading' });

    expect(mockUpdate).toHaveBeenCalledWith(1, 2, 'reading', null, null);
  });

  it('returns whatever the data layer answered with', async () => {
    const result = await updateEntry(1, 2, { review: 'text' });

    expect(result).toEqual({ user_id: 1, book_id: 2, review: 'text' });
  });
});
