-- Reset password using a valid (non-expired) token; clears the token afterwards
CREATE OR REPLACE FUNCTION fn_reset_password(
    p_token    VARCHAR,
    p_new_hash VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users
    SET password_hash          = p_new_hash,
        reset_token            = NULL,
        reset_token_expires_at = NULL
    WHERE reset_token = p_token
      AND reset_token_expires_at > NOW();

    RETURN FOUND;
END;
$$;
