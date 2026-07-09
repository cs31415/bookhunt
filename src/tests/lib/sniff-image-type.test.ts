import { sniffImageType } from '../../lib/sniff-image-type';

function bytes(...values: (number | string)[]): Buffer {
  return Buffer.concat(
    values.map((v) => (typeof v === 'string' ? Buffer.from(v, 'ascii') : Buffer.from([v]))),
  );
}

describe('sniffImageType', () => {
  it('identifies JPEG from FF D8 FF', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('image/jpeg');
  });

  it('identifies PNG from its 8-byte signature', () => {
    expect(sniffImageType(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0))).toBe('image/png');
  });

  it('identifies WebP from RIFF....WEBP', () => {
    expect(sniffImageType(bytes('RIFF', 0x24, 0x00, 0x00, 0x00, 'WEBP'))).toBe('image/webp');
  });

  it('returns null for GIF (not in the allowlist)', () => {
    expect(sniffImageType(bytes('GIF89a', 0, 0, 0, 0, 0, 0))).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(sniffImageType(Buffer.from('hello world!', 'ascii'))).toBeNull();
  });

  it('returns null for a truncated header', () => {
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for RIFF that is not WebP (e.g. WAV)', () => {
    expect(sniffImageType(bytes('RIFF', 0x24, 0x00, 0x00, 0x00, 'WAVE'))).toBeNull();
  });
});
