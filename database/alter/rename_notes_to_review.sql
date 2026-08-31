-- One field for a reader's own words, called what it is (LOS-266).
--
-- library_entries carried two: `notes`, the real one, written from the book
-- page and documented as private; and `review`, plumbed end to end through the
-- functions and the model layer and never written by anything. Every row had
-- review IS NULL, verified on production before this ran.
--
-- So the empty column goes and the real one takes its name. Dropping first is
-- what makes the rename possible at all -- the target name has to be free.
--
-- Guarded on `notes` still existing rather than by IF NOT EXISTS, because
-- RENAME has no such clause and would fail on a second run. With the guard this
-- is safe to re-run, like every other script here.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'library_entries' AND column_name = 'notes'
    ) THEN
        ALTER TABLE library_entries DROP COLUMN IF EXISTS review;
        ALTER TABLE library_entries RENAME COLUMN notes TO review;
    END IF;
END $$;
