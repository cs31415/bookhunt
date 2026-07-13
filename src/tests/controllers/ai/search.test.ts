import { Request, Response } from 'express';
import { search } from '../../../controllers/ai/search';
import * as searchModel from '../../../models/ai/search';
import * as searchClaudeModel from '../../../models/ai/search-claude';

jest.mock('../../../models/ai/search');
jest.mock('../../../models/ai/search-claude');

const mockSearchBooks = searchModel.searchBooks as jest.Mock;
const mockMatchLibraryEntries = searchModel.matchLibraryEntries as jest.Mock;
const mockSearchBooksWithClaude = searchClaudeModel.searchBooksWithClaude as jest.Mock;

const bookInLibrary = {
  googleBooksId: 'a',
  title: 'A',
  inLibrary: true,
  libraryStatus: 'read',
};
const bookNotInLibrary = {
  googleBooksId: 'b',
  title: 'B',
  inLibrary: false,
  libraryStatus: null,
};

function makeReq(body: object, user?: { id: number; email: string }) {
  return { body, user } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('search controller', () => {
  beforeEach(() => {
    mockSearchBooksWithClaude.mockResolvedValue([]);
  });

  it('returns 400 when query is missing', async () => {
    const res = makeRes();
    await search(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Query parameter is required' });
  });

  it('returns 400 when query is blank', async () => {
    const res = makeRes();
    await search(makeReq({ query: '   ' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns books with library books sorted first', async () => {
    mockSearchBooks.mockResolvedValue([bookNotInLibrary, bookInLibrary]);
    mockMatchLibraryEntries.mockResolvedValue(undefined);
    const res = makeRes();
    await search(makeReq({ query: 'cats' }, { id: 1, email: 'a@b.com' }), res);
    expect(res.json).toHaveBeenCalledWith({
      books: [bookInLibrary, bookNotInLibrary],
      query: 'cats',
    });
  });

  it('filters to library-only books when inLibraryOnly is true', async () => {
    mockSearchBooks.mockResolvedValue([bookNotInLibrary, bookInLibrary]);
    mockMatchLibraryEntries.mockResolvedValue(undefined);
    const res = makeRes();
    await search(makeReq({ query: 'cats', inLibraryOnly: true }, { id: 1, email: 'a@b.com' }), res);
    expect(res.json).toHaveBeenCalledWith({
      books: [bookInLibrary],
      query: 'cats',
    });
  });

  it('skips matchLibraryEntries when user is not authenticated', async () => {
    mockSearchBooks.mockResolvedValue([bookNotInLibrary]);
    const res = makeRes();
    await search(makeReq({ query: 'cats' }), res);
    expect(mockMatchLibraryEntries).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ books: [bookNotInLibrary], query: 'cats' });
  });

  it('uses provided limit when calling searchBooks', async () => {
    mockSearchBooks.mockResolvedValue([]);
    const res = makeRes();
    await search(makeReq({ query: 'dogs', limit: 5 }), res);
    expect(mockSearchBooks).toHaveBeenCalledWith('dogs', 5);
  });

  it('returns 500 on unexpected error', async () => {
    mockSearchBooks.mockRejectedValue(new Error('network'));
    const res = makeRes();
    await search(makeReq({ query: 'cats' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('uses LLM results when non-empty and does not call searchBooks', async () => {
    const llmBook = { googleBooksId: null, title: 'LLM Pick', inLibrary: false, libraryStatus: null, source: 'gemini-3.1-flash-lite' };
    mockSearchBooksWithClaude.mockResolvedValue([llmBook]);
    const res = makeRes();
    await search(makeReq({ query: 'cats' }), res);
    expect(mockSearchBooks).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ books: [llmBook], query: 'cats' });
  });

  it('falls back to searchBooks when Claude returns no results', async () => {
    mockSearchBooksWithClaude.mockResolvedValue([]);
    mockSearchBooks.mockResolvedValue([bookNotInLibrary]);
    const res = makeRes();
    await search(makeReq({ query: 'cats' }), res);
    expect(mockSearchBooks).toHaveBeenCalledWith('cats', 20);
    expect(res.json).toHaveBeenCalledWith({ books: [bookNotInLibrary], query: 'cats' });
  });

  it('forwards seedCategory and seedMood to searchBooksWithClaude', async () => {
    const res = makeRes();
    await search(makeReq({ query: 'cats', seedCategory: 'Philosophy', seedMood: 'Rigorous' }), res);
    expect(mockSearchBooksWithClaude).toHaveBeenCalledWith('cats', 20, 'Philosophy', 'Rigorous');
  });

  it('passes undefined seedCategory/seedMood to searchBooksWithClaude when not provided', async () => {
    const res = makeRes();
    await search(makeReq({ query: 'cats' }), res);
    expect(mockSearchBooksWithClaude).toHaveBeenCalledWith('cats', 20, undefined, undefined);
  });
});
