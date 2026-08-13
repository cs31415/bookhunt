import { sendEmail } from '../../../lib/email/send-email';
import { getResend, resetResendClient } from '../../../lib/email/resend-client';

jest.mock('../../../lib/email/resend-client', () => ({
  ...jest.requireActual('../../../lib/email/resend-client'),
  getResend: jest.fn(),
}));

const mockGetResend = getResend as jest.Mock;

const message = {
  to: 'reader@example.com',
  subject: 'Confirm your BookHunt address',
  html: '<p>link</p>',
  text: 'link',
};

function mockSend(result: unknown) {
  const send = jest.fn().mockResolvedValue(result);
  mockGetResend.mockReturnValue({ emails: { send } });
  return send;
}

beforeEach(() => {
  resetResendClient();
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'noreply@bookhunt.app';
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe('sendEmail', () => {
  it('sends through Resend and reports success', async () => {
    const send = mockSend({ data: { id: 'msg_1' }, error: null });

    await expect(sendEmail(message)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith({
      from: 'noreply@bookhunt.app',
      to: 'reader@example.com',
      subject: 'Confirm your BookHunt address',
      html: '<p>link</p>',
      text: 'link',
    });
  });

  it('logs to the console instead of sending when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    const send = mockSend({ data: null, error: null });

    await expect(sendEmail(message)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
    // The console line carries the link, which is what makes the whole flow
    // runnable locally with no mail account.
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('link'));
  });

  it('reports failure when Resend rejects the message in its response', async () => {
    // Resend reports a rejected send in the body rather than by throwing, so an
    // unchecked call looks successful for mail that never went out.
    mockSend({ data: null, error: { message: 'domain not verified' } });

    await expect(sendEmail(message)).resolves.toBe(false);
  });

  it('never throws when the transport itself fails', async () => {
    mockGetResend.mockReturnValue({
      emails: { send: jest.fn().mockRejectedValue(new Error('network down')) },
    });

    // Callers reach this after the account or reset token is already committed,
    // so a throw here would report failure for work that succeeded.
    await expect(sendEmail(message)).resolves.toBe(false);
  });

  it('falls back to the default from address', async () => {
    delete process.env.EMAIL_FROM;
    const send = mockSend({ data: { id: 'msg_1' }, error: null });

    await sendEmail(message);
    // bookhunt.net, not the .app this used to assert: that domain is not ours,
    // so mail from it could never have been delivered.
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'noreply@bookhunt.net' }));
  });

  it('sets Reply-To when EMAIL_REPLY_TO is configured', async () => {
    process.env.EMAIL_REPLY_TO = 'hello@bookhunt.net';
    const send = mockSend({ data: { id: 'msg_1' }, error: null });

    await sendEmail(message);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'hello@bookhunt.net' }));
  });

  it('omits Reply-To entirely when unset, since Resend rejects an empty one', async () => {
    delete process.env.EMAIL_REPLY_TO;
    const send = mockSend({ data: { id: 'msg_1' }, error: null });

    await sendEmail(message);
    expect(send.mock.calls[0][0]).not.toHaveProperty('replyTo');
  });
});
