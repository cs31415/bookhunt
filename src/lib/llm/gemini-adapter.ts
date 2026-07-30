import { GoogleGenAI } from '@google/genai';
import { LlmTruncatedError } from './llm-errors';
import { LlmRequest } from './llm-types';
import { fetchImageAsBase64 } from './fetch-image-as-base64';

let _gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _gemini;
}

export async function completeWithGemini(model: string, request: LlmRequest): Promise<string> {
  // Gemini's fileData parts only accept File API / GCS URIs, so presigned S3 URLs
  // must be fetched and inlined as base64.
  const images = await Promise.all((request.imageUrls ?? []).map((url) => fetchImageAsBase64(url)));
  const parts = [
    ...images.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
    { text: request.prompt },
  ];

  const response = await getGemini().models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { maxOutputTokens: request.maxTokens },
  });

  if (!request.tolerateTruncation && response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new LlmTruncatedError('google', model, request.maxTokens);
  }

  return response.text ?? '';
}
