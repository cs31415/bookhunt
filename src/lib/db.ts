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
    const value = Reflect.get(getPool(), prop);
    if (prop !== 'query' || typeof value !== 'function') {
      return typeof value === 'function' ? value.bind(getPool()) : value;
    }

    const query = value.bind(getPool());
    return async (...args: unknown[]) => {
      if (!isDbLoggingEnabled()) {
        return query(...args);
      }
      const [textOrConfig] = args as [string | { text: string }];
      const text = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
      const start = Date.now();
      const result = await query(...args);
      console.log(`[sql] query "${text}", ${Date.now() - start}ms`);
      return result;
    };
  },
});
