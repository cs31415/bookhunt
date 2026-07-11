import { Request, Response } from 'express';
import { getFacets } from '../../../controllers/search/get-facets';
import * as getFacetsModel from '../../../models/search/get-facets';

jest.mock('../../../models/search/get-facets');

const mockGetSearchFacets = getFacetsModel.getSearchFacets as jest.Mock;

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('getFacets controller', () => {
  it('returns subjects and moods from the model', async () => {
    mockGetSearchFacets.mockResolvedValue({ subjects: ['History', 'Science'], moods: ['Lyrical'] });
    const res = makeRes();

    await getFacets({} as Request, res);

    expect(res.json).toHaveBeenCalledWith({ subjects: ['History', 'Science'], moods: ['Lyrical'] });
  });

  it('defaults to empty arrays when the model returns no row', async () => {
    mockGetSearchFacets.mockResolvedValue(undefined);
    const res = makeRes();

    await getFacets({} as Request, res);

    expect(res.json).toHaveBeenCalledWith({ subjects: [], moods: [] });
  });

  it('returns 500 on error', async () => {
    mockGetSearchFacets.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await getFacets({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
