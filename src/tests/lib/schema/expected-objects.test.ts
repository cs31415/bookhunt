import fs from 'fs';
import path from 'path';
import {
  EXPECTED_FUNCTIONS,
  EXPECTED_TABLES,
} from '../../../lib/schema/expected-objects';

const DATABASE_DIR = path.join(__dirname, '../../../../database');

function read(file: string): string {
  return fs.readFileSync(path.join(DATABASE_DIR, file), 'utf8');
}

/**
 * The lists in expected-objects.ts are hardcoded, because the Docker image
 * ships dist/ only and has no database/ directory to read at runtime. These
 * tests are what stop them drifting: they read the setup files, which are the
 * real source of truth, and fail when the two disagree.
 */
describe('the expected-object lists match the setup scripts', () => {
  it('lists every table setup_tables.sql creates', () => {
    const declared = [...read('setup_tables.sql').matchAll(/tables\/([a-z_]+)\.sql/g)]
      .map((match) => match[1])
      // reading_status is a TYPE, not a table, so it is not in the list.
      .filter((name) => name !== 'reading_status');

    expect([...EXPECTED_TABLES].sort()).toEqual([...declared].sort());
  });

  it('lists every function the loaded files declare, not the file names', () => {
    // Several files declare more than one function -- fn_user_favorites.sql
    // alone declares five. Deriving these from filenames produced names no
    // database will ever have, and a check that refused to start against a
    // perfectly good schema.
    const files = [...read('setup_functions.sql').matchAll(/functions\/([a-z_0-9]+)\.sql/g)].map(
      (match) => match[1],
    );

    const declared = new Set<string>();
    for (const file of files) {
      const body = fs.readFileSync(path.join(DATABASE_DIR, 'functions', `${file}.sql`), 'utf8');
      for (const match of body.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_0-9]+)/gi)) {
        declared.add(match[1]);
      }
    }

    // The message on failure is the point: it names what to add where.
    expect([...EXPECTED_FUNCTIONS].sort()).toEqual([...declared].sort());
  });

  it('expects more functions than there are files, since files declare several', () => {
    const fileCount = [...read('setup_functions.sql').matchAll(/functions\//g)].length;
    expect(EXPECTED_FUNCTIONS.length).toBeGreaterThan(fileCount);
  });

  it('has no duplicates in either list', () => {
    expect(new Set(EXPECTED_TABLES).size).toBe(EXPECTED_TABLES.length);
    expect(new Set(EXPECTED_FUNCTIONS).size).toBe(EXPECTED_FUNCTIONS.length);
  });

  it('names a file that actually exists for each entry', () => {
    for (const table of EXPECTED_TABLES) {
      expect(fs.existsSync(path.join(DATABASE_DIR, 'tables', `${table}.sql`))).toBe(true);
    }
    // Functions are not checked this way: a name need not have its own file.
  });
});
