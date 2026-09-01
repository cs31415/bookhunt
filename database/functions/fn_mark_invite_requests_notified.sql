-- Mark requests as reported (LOS-381).
--
-- Called only after the digest has actually been sent. A send that fails leaves
-- the rows pending, so the next run picks them up rather than dropping a day of
-- people on the floor.
--
-- Takes ids rather than a timestamp: marking "everything older than now" would
-- also mark requests that arrived while the mail was in flight and were never
-- in it.
CREATE OR REPLACE FUNCTION fn_mark_invite_requests_notified(p_ids INT[])
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE invite_requests
       SET notified_at = NOW()
     WHERE id = ANY(p_ids)
       AND notified_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
