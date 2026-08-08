export function isCacheLoggingEnabled(): boolean {
  return process.env.LOG_CACHE_QUERIES === 'true';
}
