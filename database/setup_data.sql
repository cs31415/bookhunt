-- BookHunt: load the seed content every environment needs.
-- Run with: psql -d <database> -f database/setup_data.sql
--
-- Distinct from setup_tables.sql because this is content, not schema: rows the
-- app ships with rather than rows a reader creates. Every file here must be
-- idempotent, since this runs on a fresh database and on an existing one alike.

\ir data/canned_searches_seed.sql
