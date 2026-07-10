import { sniffImageType } from '../sniff-image-type';

export async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (HTTP ${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type');
  const mimeType =
    contentType?.startsWith('image/') ? contentType : (sniffImageType(buffer.subarray(0, 12)) ?? 'image/jpeg');

  return { mimeType, data: buffer.toString('base64') };
}
