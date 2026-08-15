-- LOS-248, step three: close the nullable window opened by add_user_handle.sql.
--
-- Run only after scripts/backfill-handles.js reports no accounts left without a
-- handle. It fails loudly rather than quietly if any remain, because a NOT NULL
-- that cannot be applied means someone would be left unable to be linked to.

DO $$
DECLARE
    missing INT;
BEGIN
    SELECT COUNT(*) INTO missing FROM users WHERE handle IS NULL;

    IF missing > 0 THEN
        RAISE EXCEPTION
            '% user(s) still have no handle. Run scripts/backfill-handles.js first.',
            missing;
    END IF;
END;
$$;

ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
