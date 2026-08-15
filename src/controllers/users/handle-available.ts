import { Request, Response } from 'express';
import { checkHandle } from '../../models/users/check-handle';

/**
 * @swagger
 * /users/handle-available:
 *   get:
 *     tags: [Users]
 *     summary: Check whether a handle can be claimed
 *     description: >
 *       Backs the live check on the sign-up form. Advisory only: two people can
 *       both be told yes and one of them will still lose the INSERT, so
 *       /auth/register remains the authority and answers 409.
 *     parameters:
 *       - in: query
 *         name: handle
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The answer, with a reason when the handle cannot be used
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 handle: { type: string, description: The normalized form }
 *                 available: { type: boolean }
 *                 reason: { type: string, nullable: true }
 *       400:
 *         description: No handle given
 */
export async function handleAvailable(req: Request, res: Response) {
  const { handle } = req.query;

  if (typeof handle !== 'string' || handle.trim().length === 0) {
    res.status(400).json({ error: 'A handle is required.' });
    return;
  }

  try {
    res.json(await checkHandle(handle));
  } catch (err) {
    console.error('Handle availability error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
