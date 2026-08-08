import { frontendUrl } from '../../frontend-url';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * The email forgot-password was always supposed to send. Until LOS-218 the
 * token was written to the database and the reader was told nothing, so the
 * flow could not be completed at all.
 *
 * No display name: this is reachable by typing any address into a form, and the
 * reply is deliberately identical whether or not an account exists. Greeting
 * someone by name would leak exactly what the endpoint is careful not to.
 */
export function passwordResetEmail(token: string) {
  const link = frontendUrl(`/reset-password?token=${encodeURIComponent(token)}`);

  return {
    subject: 'Reset your BookHunt password',
    text: [
      'Someone asked to reset the password for this BookHunt account.',
      '',
      link,
      '',
      'The link is good for one hour. If this was not you, ignore this email --',
      'your password has not changed.',
    ].join('\n'),
    html: [
      '<p>Someone asked to reset the password for this BookHunt account.</p>',
      `<p><a href="${link}">Choose a new password</a></p>`,
      `<p>Or paste this into your browser:<br>${link}</p>`,
      '<p>The link is good for one hour. If this was not you, ignore this email — your password has not changed.</p>',
    ].join('\n'),
  };
}
