import { isStubEdition } from '../../../models/authors/is-stub-edition';

describe('isStubEdition', () => {
  it('is a stub when the provider gave nothing but a title', () => {
    // The real case: "Cryptonomicon 8c" alongside a full Cryptonomicon record.
    expect(isStubEdition({ coverUrl: null, blurb: null, pages: null })).toBe(true);
  });

  it.each([
    ['a cover', { coverUrl: 'https://example.com/c.jpg', blurb: null, pages: null }],
    ['a blurb', { coverUrl: null, blurb: 'A gripping thriller.', pages: null }],
    ['a page count', { coverUrl: null, blurb: null, pages: 932 }],
  ])('is not a stub when the record has %s', (_label, work) => {
    // One signal is enough. A real book occasionally lacks a cover, or a
    // blurb, or a page count; a stub lacks the lot.
    expect(isStubEdition(work)).toBe(false);
  });

  it('takes no view of ownership, because the library match is fuzzy', () => {
    // matchLibraryEntries marks "Cryptonomicon 8c" as owned on the strength of
    // the reader's real Cryptonomicon. A guard on that flag would protect
    // exactly the records this exists to remove, so the caller filters before
    // the match instead.
    expect(
      isStubEdition({ coverUrl: null, blurb: null, pages: null } as never),
    ).toBe(true);
  });

  it('treats a blank blurb as no blurb', () => {
    expect(isStubEdition({ coverUrl: null, blurb: '   ', pages: null })).toBe(true);
  });

  it('treats a zero page count as no page count', () => {
    expect(isStubEdition({ coverUrl: null, blurb: null, pages: 0 })).toBe(true);
  });

  it('treats absent fields the same as null ones', () => {
    expect(isStubEdition({})).toBe(true);
  });
});
