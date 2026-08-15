-- LOS-248: give every user a public handle.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. Everything here is idempotent and can be run again safely.
--
-- Run this FIRST, then scripts/backfill-handles.js, then
-- alter/set_user_handle_not_null.sql. The column arrives nullable because
-- existing rows have nothing to put in it yet; the third step closes that gap
-- once the backfill has filled them.

ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR(30);

-- The lowercase index, not the column, is the uniqueness rule: handles are
-- folded to lowercase before they are stored, and this catches anything that
-- got in another way.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_lower ON users (LOWER(handle));
