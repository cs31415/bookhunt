import { Request, Response } from 'express';
import crypto from 'crypto';
import { createPresignedUrl } from '../../models/upload/presign';

export async function presign(req: Request, res: Response) {
  try {
    const { files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'files must be a non-empty array' });
      return;
    }
    if (files.length > 10) {
      res.status(400).json({ error: 'files must contain at most 10 items' });
      return;
    }
    if (!files.every((f) => typeof f?.contentType === 'string' && f.contentType.startsWith('image/'))) {
      res.status(400).json({ error: 'each file must have a contentType that is an image type' });
      return;
    }

    const results = await Promise.all(
      files.map(async (f: { contentType: string }) => {
        const key = `uploads/${req.user!.id}/${crypto.randomUUID()}`;
        const url = await createPresignedUrl(key, f.contentType);
        return { url, key };
      }),
    );
    res.json(results);
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
