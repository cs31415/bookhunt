import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getS3 } from '../../lib/s3';
import { MAX_IMAGE_BYTES, isAllowedImageType } from '../../lib/upload-constraints';
import { sniffImageType } from '../../lib/sniff-image-type';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export class ImageValidationError extends Error {
  constructor(public readonly key: string) {
    super(`invalid or unsupported image: ${key}`);
    this.name = 'ImageValidationError';
  }
}

/**
 * Rejects keys the requesting user does not own, and objects that are missing,
 * oversized, outside the content-type allowlist, or whose leading bytes do not
 * match the declared type. Throws ImageValidationError on the first bad key.
 */
export async function validateImageKeys(imageKeys: string[], userId: number): Promise<void> {
  const ownKey = new RegExp(`^uploads/${userId}/${UUID}$`);
  for (const key of imageKeys) {
    if (!ownKey.test(key)) {
      throw new ImageValidationError(key);
    }
  }

  const bucket = process.env.S3_BUCKET_NAME!;
  await Promise.all(
    imageKeys.map(async (key) => {
      let contentType: string;
      try {
        const head = await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (
          !head.ContentLength ||
          head.ContentLength > MAX_IMAGE_BYTES ||
          !head.ContentType ||
          !isAllowedImageType(head.ContentType)
        ) {
          throw new ImageValidationError(key);
        }
        contentType = head.ContentType;

        const object = await getS3().send(
          new GetObjectCommand({ Bucket: bucket, Key: key, Range: 'bytes=0-11' }),
        );
        const header = Buffer.from(await object.Body!.transformToByteArray());
        if (sniffImageType(header) !== contentType) {
          throw new ImageValidationError(key);
        }
      } catch (error) {
        if (error instanceof ImageValidationError) throw error;
        // Missing object, access error, or truncated read — treat as an invalid key, not a 500
        throw new ImageValidationError(key);
      }
    }),
  );
}
