-- Register a new user; lets the UNIQUE constraints raise on duplicates. Both
-- the email pair (users.email and idx_users_email_lower) and the handle index
-- (idx_users_handle_lower) surface as SQLSTATE 23505, so the controller reads
-- err.constraint to tell the caller which of the two collided.
--
-- The account starts unverified: email_verified_at stays NULL and login refuses
-- it until fn_verify_email is called with the token minted here (LOS-218).

-- Explicit drop of the pre-LOS-218 three-argument signature and the pre-LOS-248
-- five-argument one. Adding parameters makes CREATE OR REPLACE define an
-- overload rather than replace anything, so without these an existing database
-- keeps older fn_register_user versions -- unreachable from the app, and
-- exactly the sort of thing someone later calls by hand from psql. The
-- five-argument drop also has to happen because the return type gains handle,
-- which CREATE OR REPLACE cannot change in place.
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION fn_register_user(
    p_email        VARCHAR,
    p_password_hash VARCHAR,
    p_display_name  VARCHAR,
    p_handle        VARCHAR,
    p_verification_token      VARCHAR,
    p_verification_expires_at TIMESTAMPTZ
)
RETURNS TABLE(id INT, email VARCHAR, display_name VARCHAR, handle VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (email, password_hash, display_name, handle,
                       verification_token, verification_token_expires_at)
    VALUES (p_email, p_password_hash, p_display_name, p_handle,
            p_verification_token, p_verification_expires_at)
    RETURNING users.id, users.email, users.display_name, users.handle, users.created_at;
END;
$$;
