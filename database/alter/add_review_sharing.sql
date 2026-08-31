-- Publishing a review, globally and per book (LOS-266).
--
-- users.share_reviews is the global switch. FALSE by default, and that is the
-- whole point rather than a detail: any other default retroactively publishes
-- text people wrote when this column was called `notes` and documented as
-- private. A reader who changes nothing must publish nothing.
--
-- library_entries.share_review is the per-book override, deliberately nullable.
-- NULL means inherit, so COALESCE(le.share_review, u.share_reviews) gives three
-- states out of one column -- and setting a book back to Default restores
-- inheritance rather than freezing whatever the global happened to be.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS share_reviews BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE library_entries
    ADD COLUMN IF NOT EXISTS share_review BOOLEAN;
