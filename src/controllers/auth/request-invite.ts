import { Request, Response } from 'express';
import { requestInvite as recordRequest, MAX_NOTE_LENGTH } from '../../models/auth/request-invite';
import { isValidEmail } from '../../lib/validate/is-valid-email';

/**
 * @swagger
 * /auth/request-invite:
 *   post:
 *     tags: [Auth]
 *     summary: Ask to be sent an invite code
 *     description: >
 *       Records the request. Sends nothing, to anybody. Always answers 202 for
 *       a well-formed address, whether or not that address is already
 *       registered, so the endpoint cannot be used to find out who has an
 *       account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               note:  { type: string, maxLength: 500 }
 *               website:
 *                 type: string
 *                 description: >
 *                   Honeypot. Hidden from people and left empty by them; a bot
 *                   filling in every field trips it. A filled value is answered
 *                   202 and discarded.
 *     responses:
 *       202:
 *         description: Recorded, or silently discarded. The two are the same reply.
 *       400:
 *         description: The address is not a valid one
 */
export async function requestInvite(req: Request, res: Response) {
  const { email, note, website } = req.body ?? {};

  /*
   * The honeypot, checked first. Answered exactly as a success is: a bot that
   * learns which of its submissions were dropped is a bot that stops filling
   * the field in.
   */
  if (typeof website === 'string' && website.trim() !== '') {
    res.status(202).json({ received: true });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'A valid email address is required.', field: 'email' });
    return;
  }

  if (note != null && typeof note !== 'string') {
    res.status(400).json({ error: 'That note could not be read.', field: 'note' });
    return;
  }

  if (typeof note === 'string' && note.length > MAX_NOTE_LENGTH) {
    res.status(400).json({
      error: `Please keep that under ${MAX_NOTE_LENGTH} characters.`,
      field: 'note',
    });
    return;
  }

  try {
    await recordRequest(email, note ?? null);
  } catch (err) {
    /*
     * Swallowed on purpose. The reader can do nothing about a database that is
     * down, and telling them the request failed invites them to submit it
     * again, and again. It is logged for whoever can act on it.
     */
    console.error('Invite request error:', err);
  }

  // 202 either way: recorded, discarded, or lost. Nothing here reveals whether
  // the address already has an account.
  res.status(202).json({ received: true });
}
