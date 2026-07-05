import { extractResponseText } from '../../lib/extract-response-text';

describe('extractResponseText', () => {
  it('returns the text of the first text block', () => {
    const response = { content: [{ type: 'text', text: 'hello' }] } as any;
    expect(extractResponseText(response, 'fallback')).toBe('hello');
  });

  it('skips non-text blocks and finds the text one', () => {
    const response = {
      content: [{ type: 'image', source: {} }, { type: 'text', text: 'found it' }],
    } as any;
    expect(extractResponseText(response, 'fallback')).toBe('found it');
  });

  it('returns the fallback when there is no text block', () => {
    const response = { content: [{ type: 'image', source: {} }] } as any;
    expect(extractResponseText(response, 'fallback')).toBe('fallback');
  });

  it('returns the fallback for an empty content array', () => {
    const response = { content: [] } as any;
    expect(extractResponseText(response, '[]')).toBe('[]');
  });
});
