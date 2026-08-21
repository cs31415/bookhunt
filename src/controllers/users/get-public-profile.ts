import { Request, Response } from 'express';
import { publicLibrary, publicProfile } from '../../models/users/public-profile';
import { favoriteState } from '../../models/users/favorites';

/**
 * @swagger
 * /users/{handle}:
 *   get:
 *     tags: [Users]
 *     summary: A reader's public profile
 *     description: >
 *       Answers 404 both for a handle that does not exist and for one whose
 *       owner has not made their page public. The two are deliberately
 *       indistinguishable: a different answer for each would tell a caller
 *       which handles are taken.
 *     parameters:
 *       - in: path
 *         name: handle
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The profile header and its counts
 *       404:
 *         description: No such public profile
 */
export async function getPublicProfile(req: Request, res: Response) {
  try {
    const profile = await publicProfile(String(req.params.handle));

    if (!profile) {
      res.status(404).json({ error: 'No such profile' });
      return;
    }

    // Only meaningful for a signed-in viewer. Absent for a guest, which the
    // page reads as not favourited -- the same value an un-pressed heart shows.
    if (!req.user) {
      res.json({ profile });
      return;
    }

    const state = await favoriteState(req.user.id, String(req.params.handle));
    res.json({ profile: { ...profile, ...(state ?? {}) } });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/{handle}/library:
 *   get:
 *     tags: [Users]
 *     summary: A reader's public library
 *     description: >
 *       Hidden books never appear, and the rows carry no notes or reviews --
 *       those are absent from the stored function's row type, not filtered out
 *       here. Answers 404 on the same terms as the profile above.
 *     parameters:
 *       - in: path
 *         name: handle
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [queued, reading, finished, abandoned] }
 *       - in: query
 *         name: favorites
 *         schema: { type: boolean }
 *       - in: query
 *         name: q
 *         description: Narrows the shelf to books whose title or author matches.
 *         schema: { type: string }
 *       - in: query
 *         name: subject
 *         description: >
 *           Narrows the shelf to one category. Matched whole rather than as a
 *           substring, so "Fiction" does not pull in "Science Fiction".
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 24, maximum: 60 }
 *     responses:
 *       200:
 *         description: Entries with pagination
 *       404:
 *         description: No such public profile
 */
export async function getPublicLibrary(req: Request, res: Response) {
  try {
    const handle = String(req.params.handle);

    // Asked first, so an empty shelf and a private one give different answers:
    // an empty public library is 200 with no entries, a private one is 404.
    const profile = await publicProfile(handle);
    if (!profile) {
      res.status(404).json({ error: 'No such profile' });
      return;
    }

    res.json(await publicLibrary(handle, req.query));
  } catch (error) {
    console.error('Error fetching public library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
