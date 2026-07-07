import { Request, Response } from 'express';
import crypto from 'crypto';
import { createPresignedUpload } from '../../models/upload/create-presigned-upload';
import { ALLOWED_IMAGE_TYPES, isAllowedImageType } from '../../lib/upload-constraints';

/**
 * @swagger
 * /upload/presign:
 *   post:
 *     tags: [Upload]
 *     summary: Get presigned S3 POST policies for direct image upload
 *     description: |
 *       Send `{ files: [{ contentType }, …] }` (1–10 items) and receive `[{ url, fields, key }, …]`.
 *       Upload each file with a multipart form POST to its `url`, including every `fields` entry
 *       plus the file itself as the `file` field (no auth header required for the S3 POST).
 *       S3 enforces the policy at upload time: max 10 MB per image and exact content-type match.
 *       Allowed content types: `image/jpeg`, `image/png`, `image/webp`. HEIC is not supported —
 *       convert to JPEG client-side before requesting a presigned upload.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   required: [contentType]
 *                   properties:
 *                     contentType: { type: string, enum: [image/jpeg, image/png, image/webp] }
 *     responses:
 *       200:
 *         description: Presigned upload POST policies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   url: { type: string }
 *                   fields:
 *                     type: object
 *                     additionalProperties: { type: string }
 *                   key: { type: string }
 *       400:
 *         description: Invalid files array or unsupported content type
 *       429:
 *         description: Rate limited (5/min)
 */
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
    if (!files.every((f) => typeof f?.contentType === 'string' && isAllowedImageType(f.contentType))) {
      res.status(400).json({
        error: `each file must have a contentType of ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      });
      return;
    }

    const results = await Promise.all(
      files.map(async (f: { contentType: string }) => {
        const key = `uploads/${req.user!.id}/${crypto.randomUUID()}`;
        const { url, fields } = await createPresignedUpload(key, f.contentType);
        return { url, fields, key };
      }),
    );
    res.json(results);
  } catch (error) {
    console.error('Error generating presigned upload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
