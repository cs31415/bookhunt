import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { validateImageKeys, ImageValidationError } from '../../../models/upload/validate-image-keys';
import { getS3 } from '../../../lib/s3';

jest.mock('../../../lib/s3');

const mockGetS3 = getS3 as jest.Mock;
const mockSend = jest.fn();

const OWN_KEY = 'uploads/1/123e4567-e89b-42d3-a456-426614174000';
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

function mockS3Object(head: { ContentLength?: number; ContentType?: string }, header: Buffer) {
  mockSend.mockImplementation((command: unknown) => {
    if (command instanceof HeadObjectCommand) return Promise.resolve(head);
    if (command instanceof GetObjectCommand) {
      return Promise.resolve({ Body: { transformToByteArray: () => Promise.resolve(header) } });
    }
    return Promise.reject(new Error('unexpected command'));
  });
}

describe('validateImageKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    mockGetS3.mockReturnValue({ send: mockSend });
  });

  it('accepts an owned key with valid size, type, and magic bytes', async () => {
    mockS3Object({ ContentLength: 12345, ContentType: 'image/jpeg' }, JPEG_HEADER);
    await expect(validateImageKeys([OWN_KEY], 1)).resolves.toBeUndefined();
  });

  it('rejects a key belonging to another user without touching S3', async () => {
    await expect(validateImageKeys(['uploads/2/123e4567-e89b-42d3-a456-426614174000'], 1))
      .rejects.toBeInstanceOf(ImageValidationError);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects a malformed key without touching S3', async () => {
    await expect(validateImageKeys(['uploads/1/../../etc/passwd'], 1))
      .rejects.toBeInstanceOf(ImageValidationError);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects an object over the size limit', async () => {
    mockS3Object({ ContentLength: 11 * 1024 * 1024, ContentType: 'image/jpeg' }, JPEG_HEADER);
    await expect(validateImageKeys([OWN_KEY], 1)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it('rejects an object with a content type outside the allowlist', async () => {
    mockS3Object({ ContentLength: 100, ContentType: 'image/svg+xml' }, JPEG_HEADER);
    await expect(validateImageKeys([OWN_KEY], 1)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it('rejects an object whose bytes do not match the declared type', async () => {
    mockS3Object({ ContentLength: 100, ContentType: 'image/jpeg' }, Buffer.from('not an image'));
    await expect(validateImageKeys([OWN_KEY], 1)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it('rejects a missing object as a validation error, not a 500', async () => {
    mockSend.mockRejectedValue(Object.assign(new Error('NotFound'), { name: 'NotFound' }));
    await expect(validateImageKeys([OWN_KEY], 1)).rejects.toBeInstanceOf(ImageValidationError);
  });
});
