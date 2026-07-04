-- Set a password-reset token and expiry for the given email (case-insensitive)
CREATE OR REPLACE FUNCTION fn_set_reset_token(
    p_email      VARCHAR,
    p_token      VARCHAR,
    p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users
    SET reset_token            = p_token,
        reset_token_expires_at = p_expires_at
    WHERE LOWER(email) = LOWER(p_email);

    RETURN FOUND;
END;
$$;
