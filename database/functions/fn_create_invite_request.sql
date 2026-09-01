-- Record a request to be invited (LOS-381).
--
-- Returns nothing the caller can learn from. The endpoint answers the same way
-- whether or not the address is already registered, so this must not report
-- that either: an unauthenticated form that distinguishes the two is an account
-- enumeration oracle, and a closed door should not be a directory.
CREATE OR REPLACE FUNCTION fn_create_invite_request(
    p_email VARCHAR,
    p_note  VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO invite_requests (email, note) VALUES (p_email, p_note);
END;
$$;
