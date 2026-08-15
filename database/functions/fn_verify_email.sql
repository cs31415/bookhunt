-- Mark an address verified using a token that has not expired, and clear the
-- token so it cannot be replayed. Returns the user row on success and no rows
-- when the token is unknown, already spent or past its expiry -- the caller
-- cannot tell those apart, and does not need to: all three are one 400.

-- Dropped rather than replaced: handle joined the result in LOS-248 so the
-- session minted here carries the same fields as a login, and Postgres cannot
-- change a return type in place.
DROP FUNCTION IF EXISTS fn_verify_email(VARCHAR);

CREATE OR REPLACE FUNCTION fn_verify_email(
    p_token VARCHAR
)
RETURNS TABLE(id INT, email VARCHAR, display_name VARCHAR, handle VARCHAR)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET email_verified_at             = NOW(),
        verification_token            = NULL,
        verification_token_expires_at = NULL
    WHERE verification_token = p_token
      AND verification_token_expires_at > NOW()
    RETURNING users.id, users.email, users.display_name, users.handle;
END;
$$;
