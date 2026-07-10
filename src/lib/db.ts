import { Pool } from 'pg';

let _pool: Pool;

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
    return (...args: Parameters<Pool['query']>) => {
      const [text, params] = args;
      const sql = typeof text === 'string' ? text : (text as { text: string }).text;
      console.log(`[db] query: ${sql}${params ? ` params: ${JSON.stringify(params)}` : ''}`);
      return (value as Pool['query']).apply(target, args);
    };
  },
});
