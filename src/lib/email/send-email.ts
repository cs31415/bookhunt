import { getResend, isEmailEnabled } from './resend-client';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends one transactional email, and never throws.
 *
 * Both callers reach this after the state change they care about has already
 * been committed -- the account exists, the reset token is stored. Turning a
 * Resend outage into a 500 at that point would report failure for work that
 * succeeded, and on registration would invite the reader to try again against
 * an address that is now taken. So a failure is logged and swallowed, and
 * recovery is the resend endpoint.
 *
 * With RESEND_API_KEY unset the message is written to the console instead,
 * including the link. That is what makes the whole flow runnable locally with
 * no mail account, and it is why the link is logged in full here and nowhere
 * else.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  if (!isEmailEnabled()) {
    console.log(
      `[email] RESEND_API_KEY unset, not sending. to=${email.to} subject="${email.subject}"\n${email.text}`,
    );
    return false;
  }

  try {
    // EMAIL_FROM may carry a display name -- Resend accepts "BookHunt
    // <noreply@bookhunt.net>" -- which is worth setting: a bare address is less
    // recognisable in an inbox list, and recognisability is one of the few
    // deliverability levers available to a domain with no sending history.
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();
    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? 'noreply@bookhunt.net',
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Only when configured: Resend rejects an empty string, and a sender that
      // accepts replies reads better to a filter than one that cannot.
      ...(replyTo ? { replyTo } : {}),
    });

    // Resend reports a rejected send in the response rather than by throwing,
    // so an unchecked call looks successful for a message that never went out.
    if (error) {
      console.error(`[email] send failed to=${email.to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] send threw to=${email.to}:`, err);
    return false;
  }
}
