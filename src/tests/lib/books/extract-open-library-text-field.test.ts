import { extractOpenLibraryTextField } from '../../../lib/books/extract-open-library-text-field';

describe('extractOpenLibraryTextField', () => {
  it('passes through a plain string', () => {
    expect(extractOpenLibraryTextField('plain text')).toBe('plain text');
  });

  it('unwraps a { value } object', () => {
    expect(extractOpenLibraryTextField({ value: 'wrapped text' })).toBe('wrapped text');
  });

  it('returns null for undefined', () => {
    expect(extractOpenLibraryTextField(undefined)).toBeNull();
  });

  it('returns null for an object with no value field', () => {
    expect(extractOpenLibraryTextField({})).toBeNull();
  });

  it('strips embedded HTML from a plain string', () => {
    expect(extractOpenLibraryTextField('A <b>bold</b> bio.<br>Second line.')).toBe('A bold bio. Second line.');
  });

  it('strips embedded HTML from a wrapped value', () => {
    expect(extractOpenLibraryTextField({ value: '<p>Wrapped &amp; cleaned</p>' })).toBe('Wrapped & cleaned');
  });
});
