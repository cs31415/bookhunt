-- BookHunt auth stored procedures

BEGIN;

-- Register a new user; lets the UNIQUE constraint on email raise on duplicates
CREATE OR REPLACE FUNCTION sp_register_user(
    p_email        VARCHAR,
    p_password_hash VARCHAR,
    p_display_name  VARCHAR
)
RETURNS TABLE(id INT, email VARCHAR, display_name VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (email, password_hash, display_name)
    VALUES (p_email, p_password_hash, p_display_name)
    RETURNING users.id, users.email, users.display_name, users.created_at;
END;
$$;

-- Find a user by email (case-insensitive); returns NULL if not found
CREATE OR REPLACE FUNCTION sp_find_user_by_email(
    p_email VARCHAR
)
RETURNS TABLE(
    id                     INT,
    email                  VARCHAR,
    password_hash          VARCHAR,
    display_name           VARCHAR,
    preferences            JSONB,
    is_discoverable        BOOLEAN,
    reset_token            VARCHAR,
    reset_token_expires_at TIMESTAMPTZ,
    created_at             TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.password_hash, u.display_name,
           u.preferences, u.is_discoverable, u.reset_token,
           u.reset_token_expires_at, u.created_at
    FROM users u
    WHERE LOWER(u.email) = LOWER(p_email);
END;
$$;

-- Set a password-reset token and expiry for the given email (case-insensitive)
CREATE OR REPLACE FUNCTION sp_set_reset_token(
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

-- Reset password using a valid (non-expired) token; clears the token afterwards
CREATE OR REPLACE FUNCTION sp_reset_password(
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

COMMIT;
