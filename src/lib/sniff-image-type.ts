import { AllowedImageType } from './upload-constraints';

/**
 * Identify an image format from the first bytes of the file (needs at least 12).
 * Returns null when the bytes match none of the allowed formats.
 */
export function sniffImageType(header: Buffer): AllowedImageType | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg';
  }
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (header.length >= 8 && header.subarray(0, 8).equals(pngSignature)) {
    return 'image/png';
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
