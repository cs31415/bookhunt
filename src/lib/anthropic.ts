import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL!;

let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}
