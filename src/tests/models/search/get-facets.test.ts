import { getSearchFacets } from '../../../models/search/get-facets';
import * as searchData from '../../../data/search-data';

jest.mock('../../../data/search-data');

const mockGetSearchFacets = searchData.getSearchFacets as jest.Mock;

describe('getSearchFacets model', () => {
  it('re-exports the data layer function', async () => {
    const row = { subjects: ['History'], moods: ['Lyrical'] };
    mockGetSearchFacets.mockResolvedValue(row);

    const result = await getSearchFacets();

    expect(mockGetSearchFacets).toHaveBeenCalled();
    expect(result).toEqual(row);
  });
});
