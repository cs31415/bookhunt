-- Register a new user; lets the UNIQUE constraint on email raise on duplicates
-- (both the column's own and idx_users_email_lower, which catches the
-- differs-only-by-case case the app used to accept as a second account).
--
-- The account starts unverified: email_verified_at stays NULL and login refuses
-- it until fn_verify_email is called with the token minted here (LOS-218).

-- Explicit drop of the pre-LOS-218 three-argument signature. Adding parameters
-- makes CREATE OR REPLACE define an overload rather than replace anything, so
-- without this an existing database keeps a second fn_register_user that still
-- creates accounts with no verification token -- unreachable from the app, and
-- exactly the sort of thing someone later calls by hand from psql.
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION fn_register_user(
    p_email        VARCHAR,
    p_password_hash VARCHAR,
    p_display_name  VARCHAR,
    p_verification_token      VARCHAR,
    p_verification_expires_at TIMESTAMPTZ
)
RETURNS TABLE(id INT, email VARCHAR, display_name VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (email, password_hash, display_name,
                       verification_token, verification_token_expires_at)
    VALUES (p_email, p_password_hash, p_display_name,
            p_verification_token, p_verification_expires_at)
    RETURNING users.id, users.email, users.display_name, users.created_at;
END;
$$;
