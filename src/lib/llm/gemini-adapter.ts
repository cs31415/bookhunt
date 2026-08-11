import { GoogleGenAI } from '@google/genai';
import { LlmTruncatedError } from './llm-errors';
import { LlmRequest } from './llm-types';

let _gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _gemini;
}

export async function completeWithGemini(model: string, request: LlmRequest): Promise<string> {
  const response = await getGemini().models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
    config: { maxOutputTokens: request.maxTokens },
  });

  if (!request.tolerateTruncation && response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new LlmTruncatedError('google', model, request.maxTokens);
  }

  return response.text ?? '';
}
