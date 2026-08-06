import { redactUrlSecrets } from '../../../lib/books/redact-url-secrets';

describe('redactUrlSecrets', () => {
  it('masks the Google Books API key', () => {
    expect(
      redactUrlSecrets('https://www.googleapis.com/books/v1/volumes?q=carl%20sagan&key=AIzaSyReal'),
    ).toBe('https://www.googleapis.com/books/v1/volumes?q=carl%20sagan&key=[redacted]');
  });

  it('masks a secret in the first query position', () => {
    expect(redactUrlSecrets('https://example.test/v1?key=AIzaSyReal&q=dune')).toBe(
      'https://example.test/v1?key=[redacted]&q=dune',
    );
  });

  it('masks a secret sitting last, with no following separator', () => {
    expect(redactUrlSecrets('https://example.test/v1?q=dune&key=AIzaSyReal')).toBe(
      'https://example.test/v1?q=dune&key=[redacted]',
    );
  });

  it('leaves the rest of the query byte-for-byte alone', () => {
    // The point of these log lines is being copy-pasteable back at the
    // provider, and exact escaping decides the result set (LOS-199).
    const url =
      'https://www.googleapis.com/books/v1/volumes?q=intitle:%22Celebrations%22+inauthor:%22Kindersley%22&maxResults=3&key=AIzaSyReal';
    expect(redactUrlSecrets(url)).toBe(
      'https://www.googleapis.com/books/v1/volumes?q=intitle:%22Celebrations%22+inauthor:%22Kindersley%22&maxResults=3&key=[redacted]',
    );
  });

  it('stops at a fragment rather than swallowing it', () => {
    expect(redactUrlSecrets('https://example.test/v1?key=AIzaSyReal#anchor')).toBe(
      'https://example.test/v1?key=[redacted]#anchor',
    );
  });

  it('masks other credential parameter names, case-insensitively', () => {
    expect(redactUrlSecrets('https://example.test/?API_KEY=abc&access_token=def&secret=ghi')).toBe(
      'https://example.test/?API_KEY=[redacted]&access_token=[redacted]&secret=[redacted]',
    );
  });

  it('does not match a parameter that merely ends in a secret name', () => {
    expect(redactUrlSecrets('https://openlibrary.org/search.json?sortkey=new&monkey=1')).toBe(
      'https://openlibrary.org/search.json?sortkey=new&monkey=1',
    );
  });

  it('leaves a URL with no secrets untouched', () => {
    const url = 'https://openlibrary.org/search.json?q=dune&limit=3';
    expect(redactUrlSecrets(url)).toBe(url);
  });

  it('degrades safely on a string URL() would reject', () => {
    expect(redactUrlSecrets('not a url?key=AIzaSyReal')).toBe('not a url?key=[redacted]');
  });
});
