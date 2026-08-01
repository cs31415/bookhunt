import { Pool } from 'pg';
import { recordDbCall } from './stats/record-db-call';

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
      const start = Date.now();
      const result: any = await query.apply(target, args);
      // Unconditional, unlike the log line below: recording is a no-op unless
      // the caller opened a stats scope, and a route that reports its own cost
      // shouldn't need LOG_DB_QUERIES turned on to do it.
      recordDbCall(result?.rowCount ?? result?.rows?.length ?? 0);
      if (isDbLoggingEnabled()) {
        const [text, params] = args;
        const sql = typeof text === 'string' ? text : (text as { text: string }).text;
        console.log(`[db] query "${sql}"${params ? ` params: ${JSON.stringify(params)}` : ''}, ${Date.now() - start}ms`);
      }
      return result;
    };
  },
});
