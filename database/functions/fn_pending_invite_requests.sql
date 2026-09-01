-- The requests not yet reported in a digest, oldest first (LOS-381).
--
-- Reads the partial index on notified_at IS NULL. The cap is the caller's, and
-- it matters: a flood should make the row count grow, not the email.
CREATE OR REPLACE FUNCTION fn_pending_invite_requests(p_limit INT)
RETURNS TABLE(id INT, email VARCHAR, note VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.email, r.note, r.created_at
      FROM invite_requests r
     WHERE r.notified_at IS NULL
     ORDER BY r.created_at
     LIMIT p_limit;
END;
$$;
