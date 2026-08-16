import { describeSchemaGap } from '../../../lib/schema/check-schema';

describe('describeSchemaGap', () => {
  it('names the missing functions and the command that loads them', () => {
    // The failure this replaces was a Postgres error buried in a stack trace,
    // several layers from anything the reader was doing.
    const message = describeSchemaGap({
      missingTables: [],
      missingFunctions: ['fn_is_favorite_author', 'fn_search_users'],
    });

    expect(message).toContain('fn_is_favorite_author, fn_search_users');
    expect(message).toContain('setup_functions.sql');
  });

  it('names the missing tables and points at the alter scripts', () => {
    const message = describeSchemaGap({
      missingTables: ['user_favorites', 'messages'],
      missingFunctions: [],
    });

    expect(message).toContain('user_favorites, messages');
    expect(message).toContain('database/alter/');
  });

  it('says which order to run them in when both are behind', () => {
    const message = describeSchemaGap({
      missingTables: ['messages'],
      missingFunctions: ['fn_send_message'],
    });

    expect(message).toContain('Tables first');
  });

  it('offers the escape hatch', () => {
    const message = describeSchemaGap({ missingTables: [], missingFunctions: ['fn_x'] });
    expect(message).toContain('SKIP_SCHEMA_CHECK=true');
  });
});
