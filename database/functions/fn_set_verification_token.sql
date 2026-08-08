-- Issue a fresh verification token for an address that exists and is still
-- unverified. Returns FOUND, which the caller deliberately discards: replying
-- differently for "no such account" and "already verified" would turn this
-- endpoint into an email-enumeration oracle, the same reason fn_set_reset_token
-- exists in this shape.
CREATE OR REPLACE FUNCTION fn_set_verification_token(
    p_email      VARCHAR,
    p_token      VARCHAR,
    p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users
    SET verification_token            = p_token,
        verification_token_expires_at = p_expires_at
    WHERE LOWER(email) = LOWER(p_email)
      AND email_verified_at IS NULL;

    RETURN FOUND;
END;
$$;
