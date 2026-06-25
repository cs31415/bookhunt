import { Request, Response } from 'express';
import crypto from 'crypto';
import { createPresignedUrl } from '../../models/upload/presign';

export async function presign(req: Request, res: Response) {
  try {
    const { contentType } = req.body;

    if (!contentType || !contentType.startsWith('image/')) {
      res.status(400).json({ error: 'contentType must be an image type' });
      return;
    }

    const key = `uploads/${req.user!.id}/${crypto.randomUUID()}`;
    const url = await createPresignedUrl(key, contentType);

    res.json({ url, key });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
