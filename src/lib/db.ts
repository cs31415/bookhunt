import { Pool } from 'pg';

let _pool: Pool;

export function isDbLoggingEnabled(): boolean {
  return process.env.LOG_DB_QUERIES === 'true';
}

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const target = getPool();
    const value = Reflect.get(target, prop);
    if (prop !== 'query' || typeof value !== 'function') {
      return typeof value === 'function' ? value.bind(target) : value;
    }
    const query = value as Pool['query'];
    return async (...args: Parameters<Pool['query']>) => {
      if (!isDbLoggingEnabled()) {
        return query.apply(target, args);
      }
      const [text, params] = args;
      const sql = typeof text === 'string' ? text : (text as { text: string }).text;
      const start = Date.now();
      const result = await query.apply(target, args);
      console.log(`[db] query "${sql}"${params ? ` params: ${JSON.stringify(params)}` : ''}, ${Date.now() - start}ms`);
      return result;
    };
  },
});
