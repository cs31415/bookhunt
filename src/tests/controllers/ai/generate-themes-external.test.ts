import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { generateThemesExternal } from '../../../controllers/ai/generate-themes-external';
import * as generateThemesExternalModel from '../../../models/ai/generate-themes-external';

jest.mock('../../../models/ai/generate-themes-external');

const mockGenerateThemesExternal = generateThemesExternalModel.generateThemesExternal as jest.Mock;

function makeReq(body: Record<string, unknown>) {
  return { body } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('generateThemesExternal controller', () => {
  it('returns 400 when title is missing', async () => {
    const res = makeRes();
    await generateThemesExternal(makeReq({ authorName: 'Author' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGenerateThemesExternal).not.toHaveBeenCalled();
  });

  it('returns 400 when authorName is blank', async () => {
    const res = makeRes();
    await generateThemesExternal(makeReq({ title: 'A Book', authorName: '   ' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGenerateThemesExternal).not.toHaveBeenCalled();
  });

  it('trims and forwards title/authorName to the model on success', async () => {
    mockGenerateThemesExternal.mockResolvedValue({ genres: ['Memoir'], themes: ['resilience'] });
    const res = makeRes();

    await generateThemesExternal(makeReq({ title: '  A Book  ', authorName: '  Some Author  ' }), res);

    expect(mockGenerateThemesExternal).toHaveBeenCalledWith('A Book', 'Some Author');
    expect(res.json).toHaveBeenCalledWith({ genres: ['Memoir'], themes: ['resilience'] });
  });

  it('returns 503 when Claude raises an API error', async () => {
    mockGenerateThemesExternal.mockRejectedValue(new Anthropic.APIError(503, undefined, 'unavailable', {}));
    const res = makeRes();
    await generateThemesExternal(makeReq({ title: 'A Book', authorName: 'Author' }), res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 500 on unexpected error', async () => {
    mockGenerateThemesExternal.mockRejectedValue(new Error('boom'));
    const res = makeRes();
    await generateThemesExternal(makeReq({ title: 'A Book', authorName: 'Author' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
