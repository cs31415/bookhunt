import { fetchImageAsBase64 } from '../../../lib/llm/fetch-image-as-base64';

const originalFetch = global.fetch;
const mockFetch = jest.fn();

function makeResponse({
  ok = true,
  status = 200,
  contentType,
  bytes,
}: {
  ok?: boolean;
  status?: number;
  contentType: string | null;
  bytes: Buffer;
}) {
  return {
    ok,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

const pngBytes = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('rest of png'),
]);

describe('fetchImageAsBase64', () => {
  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the content-type header when it is an image type', async () => {
    mockFetch.mockResolvedValue(makeResponse({ contentType: 'image/webp', bytes: pngBytes }));

    const result = await fetchImageAsBase64('https://s3/img');

    expect(result).toEqual({ mimeType: 'image/webp', data: pngBytes.toString('base64') });
  });

  it('sniffs the image type when the content-type is generic', async () => {
    mockFetch.mockResolvedValue(makeResponse({ contentType: 'application/octet-stream', bytes: pngBytes }));

    const result = await fetchImageAsBase64('https://s3/img');

    expect(result.mimeType).toBe('image/png');
  });

  it('falls back to image/jpeg when the bytes match no known format', async () => {
    mockFetch.mockResolvedValue(makeResponse({ contentType: null, bytes: Buffer.from('not an image') }));

    const result = await fetchImageAsBase64('https://s3/img');

    expect(result.mimeType).toBe('image/jpeg');
  });

  it('throws on a non-2xx response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: false, status: 403, contentType: null, bytes: Buffer.alloc(0) }));

    await expect(fetchImageAsBase64('https://s3/img')).rejects.toThrow('Failed to fetch image (HTTP 403)');
  });
});
