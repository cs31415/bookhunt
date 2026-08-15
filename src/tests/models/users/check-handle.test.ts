import { checkHandle } from '../../../models/users/check-handle';
import * as usersData from '../../../data/users-data';

jest.mock('../../../data/users-data');

const mockIsAvailable = usersData.isHandleAvailable as jest.Mock;

beforeEach(() => {
  mockIsAvailable.mockResolvedValue(true);
});

describe('checkHandle', () => {
  it('reports a free handle as available', async () => {
    await expect(checkHandle('ada')).resolves.toEqual({
      handle: 'ada',
      available: true,
      reason: null,
    });
  });

  it('reports a taken handle with a reason', async () => {
    mockIsAvailable.mockResolvedValue(false);

    await expect(checkHandle('ada')).resolves.toEqual({
      handle: 'ada',
      available: false,
      reason: 'That handle is taken.',
    });
  });

  it('returns the normalized form so the form can show what would be stored', async () => {
    await expect(checkHandle('  Ada_Reader  ')).resolves.toMatchObject({
      handle: 'ada_reader',
    });
    expect(mockIsAvailable).toHaveBeenCalledWith('ada_reader');
  });

  it('rejects a malformed handle without asking the database', async () => {
    await expect(checkHandle('ada reader')).resolves.toEqual({
      handle: 'ada reader',
      available: false,
      reason: 'Handle can contain only letters, numbers and underscores.',
    });
    // No point asking whether nonsense is taken.
    expect(mockIsAvailable).not.toHaveBeenCalled();
  });

  it('rejects a reserved handle without asking the database', async () => {
    await expect(checkHandle('library')).resolves.toMatchObject({
      available: false,
      reason: 'That handle is reserved.',
    });
    expect(mockIsAvailable).not.toHaveBeenCalled();
  });
});
