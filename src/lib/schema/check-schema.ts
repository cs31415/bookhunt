import { pool } from '../db';
import { EXPECTED_FUNCTIONS, EXPECTED_TABLES } from './expected-objects';

export interface SchemaGap {
  missingTables: string[];
  missingFunctions: string[];
}

/**
 * Compares the database against what this build of the code expects.
 *
 * Three separate incidents traced back to a database that had not caught up
 * with a deploy, and every one of them surfaced as a 500 from an unrelated
 * feature -- a Postgres "function does not exist" buried in a stack trace,
 * several layers from anything a reader was doing. This turns that into one
 * sentence at boot naming the missing objects.
 *
 * Only names are compared, not signatures. A function whose argument list
 * changed still exists, so this would not have caught the fn_register_user
 * overload; the explicit DROP in each function file is what handles that.
 * Names cover the case that actually keeps happening: a migration that was
 * never run at all.
 */
export async function findSchemaGap(): Promise<SchemaGap> {
  const [tables, functions] = await Promise.all([
    pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [EXPECTED_TABLES],
    ),
    pool.query<{ proname: string }>(
      `SELECT DISTINCT proname FROM pg_proc WHERE proname = ANY($1)`,
      [EXPECTED_FUNCTIONS],
    ),
  ]);

  const presentTables = new Set(tables.rows.map((row) => row.table_name));
  const presentFunctions = new Set(functions.rows.map((row) => row.proname));

  return {
    missingTables: EXPECTED_TABLES.filter((name) => !presentTables.has(name)),
    missingFunctions: EXPECTED_FUNCTIONS.filter((name) => !presentFunctions.has(name)),
  };
}

/** Human-readable, and it names the command that fixes each kind of gap. */
export function describeSchemaGap(gap: SchemaGap): string {
  const lines = ['The database is behind this build of the API.'];

  if (gap.missingTables.length > 0) {
    lines.push(
      '',
      `  Missing tables (${gap.missingTables.length}): ${gap.missingTables.join(', ')}`,
      '  Fix: run the matching scripts in database/alter/, oldest first.',
    );
  }

  if (gap.missingFunctions.length > 0) {
    lines.push(
      '',
      `  Missing functions (${gap.missingFunctions.length}): ${gap.missingFunctions.join(', ')}`,
      '  Fix: psql -d <db> -f database/setup_functions.sql',
    );
  }

  lines.push(
    '',
    'Tables first, then functions -- the functions reference the new columns.',
    'Set SKIP_SCHEMA_CHECK=true to start anyway.',
  );

  return lines.join('\n');
}
