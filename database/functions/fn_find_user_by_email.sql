-- Find a user by email (case-insensitive); returns NULL if not found

-- Dropped rather than replaced: email_verified_at was added to the result for
-- the login gate (LOS-218), and Postgres refuses to change an existing
-- function's return type through CREATE OR REPLACE.
DROP FUNCTION IF EXISTS fn_find_user_by_email(VARCHAR);

CREATE OR REPLACE FUNCTION fn_find_user_by_email(
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
    email_verified_at      TIMESTAMPTZ,
    created_at             TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.password_hash, u.display_name,
           u.preferences, u.is_discoverable, u.reset_token,
           u.reset_token_expires_at, u.email_verified_at, u.created_at
    FROM users u
    WHERE LOWER(u.email) = LOWER(p_email);
END;
$$;
