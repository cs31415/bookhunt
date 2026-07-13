export function isBooksProviderLoggingEnabled(): boolean {
  return process.env.LOG_BOOKS_PROVIDER_QUERIES === 'true';
}
