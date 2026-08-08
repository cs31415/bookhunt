import { frontendUrl } from '../../frontend-url';
import { escapeHtml } from '../../text/escape-html';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The email a new reader gets at sign-up. The link is also written as plain
 * text: mail clients that strip anchors, and readers who open the message on a
 * different device from the one they signed up on, both need something
 * copyable.
 */
export function verificationEmail(displayName: string, token: string) {
  // The display name is reader-supplied and lands inside an HTML document, so
  // it is escaped. The token is not: it is a UUID this server minted, and it is
  // URL-encoded into the link.
  const link = frontendUrl(`/verify-email?token=${encodeURIComponent(token)}`);

  return {
    subject: 'Confirm your BookHunt address',
    text: [
      `Hi ${displayName},`,
      '',
      'Confirm this address to finish setting up your BookHunt account:',
      link,
      '',
      'The link is good for 24 hours. If you did not sign up, ignore this email.',
    ].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(displayName)},</p>`,
      '<p>Confirm this address to finish setting up your BookHunt account.</p>',
      `<p><a href="${link}">Confirm my address</a></p>`,
      `<p>Or paste this into your browser:<br>${link}</p>`,
      '<p>The link is good for 24 hours. If you did not sign up, ignore this email.</p>',
    ].join('\n'),
  };
}
