import { send } from '../../../models/messages/messages';
import * as data from '../../../data/messages-data';

jest.mock('../../../data/messages-data');

const mockSendMessage = data.sendMessage as jest.Mock;

beforeEach(() => {
  mockSendMessage.mockResolvedValue({
    id: 1,
    body: 'hello',
    created_at: '2026-01-01T00:00:00Z',
  });
});

describe('send', () => {
  it('stores a clean message', async () => {
    await expect(send(1, 'bob', 'hello')).resolves.toMatchObject({ ok: true });
    expect(mockSendMessage).toHaveBeenCalledWith(1, 'bob', 'hello');
  });

  it('never stores a message the filter refused', async () => {
    // The whole point of checking before the insert: a rejected message is not
    // written, so it cannot be delivered or read later from the table.
    await expect(send(1, 'bob', 'you should kill yourself')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('reports a non-mutual pair without deciding it itself', async () => {
    // fn_send_message enforces the rule in SQL. This only reports what it said,
    // which is what stops a second call site from getting it wrong.
    mockSendMessage.mockResolvedValue(null);

    await expect(send(1, 'bob', 'hello')).resolves.toEqual({
      ok: false,
      reason: 'not-mutual',
    });
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['not a string', undefined],
  ])('refuses %s before touching the database', async (_label, body) => {
    await expect(send(1, 'bob', body)).resolves.toEqual({ ok: false, reason: 'empty' });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('refuses an over-long message', async () => {
    await expect(send(1, 'bob', 'x'.repeat(2001))).resolves.toEqual({
      ok: false,
      reason: 'too-long',
    });
  });

  it('normalizes the handle so case does not matter', async () => {
    await send(1, 'BOB', 'hello');
    expect(mockSendMessage).toHaveBeenCalledWith(1, 'bob', 'hello');
  });
});
