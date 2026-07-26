import { stripHtml } from '../../../lib/text/strip-html';

describe('stripHtml', () => {
  it('returns null for null/undefined', () => {
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml(undefined)).toBeNull();
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(stripHtml('')).toBeNull();
    expect(stripHtml('   ')).toBeNull();
    expect(stripHtml('<p></p>')).toBeNull();
  });

  it('leaves plain text unchanged', () => {
    expect(stripHtml('A perfectly clean description.')).toBe('A perfectly clean description.');
  });

  it('removes inline tags', () => {
    expect(stripHtml('A <b>bold</b> and <i>italic</i> tale')).toBe('A bold and italic tale');
  });

  it('turns <br> and block-close tags into spaces so words stay separated', () => {
    expect(stripHtml('First line.<br>Second line.')).toBe('First line. Second line.');
    expect(stripHtml('<p>One.</p><p>Two.</p>')).toBe('One. Two.');
    expect(stripHtml('a<br/>b<br />c')).toBe('a b c');
  });

  it('decodes named entities', () => {
    expect(stripHtml('Salt &amp; Pepper')).toBe('Salt & Pepper');
    expect(stripHtml('cats &nbsp; dogs')).toBe('cats dogs');
    expect(stripHtml('she said &ldquo;hi&rdquo;')).toBe('she said “hi”');
  });

  it('decodes numeric (decimal and hex) entities', () => {
    expect(stripHtml('it&#39;s here')).toBe("it's here");
    expect(stripHtml('caf&#xe9;')).toBe('café');
  });

  it('leaves unknown named entities untouched', () => {
    expect(stripHtml('a &fizzbuzz; b')).toBe('a &fizzbuzz; b');
  });

  it('collapses whitespace introduced by markup', () => {
    expect(stripHtml('<p>  spaced   out  </p>\n<p>text</p>')).toBe('spaced out text');
  });

  it('handles a realistic Google Books description', () => {
    const raw = '<p>A sweeping saga.</p><p>Spanning <b>three</b> generations &amp; two continents.</p>';
    expect(stripHtml(raw)).toBe('A sweeping saga. Spanning three generations & two continents.');
  });
});
