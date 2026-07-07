import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getS3 } from '../../lib/s3';
import { MAX_IMAGE_BYTES } from '../../lib/upload-constraints';

/**
 * Presigned POST (not PUT) so S3 itself enforces the policy at upload time:
 * actual byte count within content-length-range and exact Content-Type match.
 */
export async function createPresignedUpload(key: string, contentType: string) {
  const { url, fields } = await createPresignedPost(getS3(), {
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_IMAGE_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 600,
  });
  return { url, fields };
}
