import { Request, Response } from 'express';
import {
  hideAuthorFavorite,
  showAuthorFavorite,
} from '../../../controllers/authors/favorites';
import * as favoritesModel from '../../../models/authors/favorites';

jest.mock('../../../models/authors/favorites');

const mockSetVisibility = favoritesModel.setAuthorVisibility as jest.Mock;

function makeReq(slug: string) {
  return { user: { id: 7 }, params: { slug } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

beforeEach(() => {
  mockSetVisibility.mockReset();
  mockSetVisibility.mockResolvedValue(true);
});

describe('favourite author visibility', () => {
  it('PUT keeps the author off the public page', async () => {
    const res = makeRes();
    await hideAuthorFavorite(makeReq('carl-sagan'), res);

    expect(mockSetVisibility).toHaveBeenCalledWith(7, 'carl-sagan', true);
    expect(res.json).toHaveBeenCalledWith({
      author: { slug: 'carl-sagan', isHidden: true },
    });
  });

  it('DELETE puts them back', async () => {
    const res = makeRes();
    await showAuthorFavorite(makeReq('carl-sagan'), res);

    expect(mockSetVisibility).toHaveBeenCalledWith(7, 'carl-sagan', false);
    expect(res.json).toHaveBeenCalledWith({
      author: { slug: 'carl-sagan', isHidden: false },
    });
  });

  // An unknown slug and an author the reader never favourited are one case:
  // either way there is no row to hide, and neither is worth telling apart.
  it('404s when there is no such favourite', async () => {
    mockSetVisibility.mockResolvedValue(false);

    const res = makeRes();
    await hideAuthorFavorite(makeReq('nobody'), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No such favourite author' });
  });

  it('500s rather than leaking a database error', async () => {
    mockSetVisibility.mockRejectedValue(new Error('connection lost'));

    const res = makeRes();
    await hideAuthorFavorite(makeReq('carl-sagan'), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
