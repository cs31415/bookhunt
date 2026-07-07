import Anthropic from '@anthropic-ai/sdk';

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL!;
}

export function isClaudeLoggingEnabled(): boolean {
  return process.env.LOG_CLAUDE_QUERIES === 'true';
}

let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}
