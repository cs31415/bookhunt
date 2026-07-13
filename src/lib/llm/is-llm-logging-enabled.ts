export function isLlmLoggingEnabled(): boolean {
  return process.env.LOG_LLM_QUERIES === 'true';
}
