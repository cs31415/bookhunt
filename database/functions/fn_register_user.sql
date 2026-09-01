-- Register a new user; lets the UNIQUE constraints raise on duplicates. Both
-- the email pair (users.email and idx_users_email_lower) and the handle index
-- (idx_users_handle_lower) surface as SQLSTATE 23505, so the controller reads
-- err.constraint to tell the caller which of the two collided.
--
-- The account starts unverified: email_verified_at stays NULL and login refuses
-- it until fn_verify_email is called with the token minted here (LOS-218).
--
-- Claims an invite code as part of the same call (LOS-376). That is why the
-- claim lives in here rather than in the model: this function is one statement
-- to the client, so it is one transaction. A failed claim raises, the insert
-- above it rolls back, and no account -- and no verification email -- results
-- from a code that was already spent.
--
-- p_invite_code NULL means the caller is not requiring one, which is what
-- REGISTRATION_MODE=open passes. The gate is deliberately the caller's
-- decision: the database's job is to make the claim atomic, not to decide
-- policy.

-- Explicit drop of the pre-LOS-218 three-argument signature, the pre-LOS-248
-- five-argument one, and the pre-LOS-376 six-argument one. Adding parameters
-- makes CREATE OR REPLACE define an overload rather than replace anything, so
-- without these an existing database keeps older fn_register_user versions --
-- unreachable from the app, and exactly the sort of thing someone later calls
-- by hand from psql. Worse for the six-argument case: it still registers
-- without asking for a code at all.
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION fn_register_user(
    p_email        VARCHAR,
    p_password_hash VARCHAR,
    p_display_name  VARCHAR,
    p_handle        VARCHAR,
    p_verification_token      VARCHAR,
    p_verification_expires_at TIMESTAMPTZ,
    p_invite_code   VARCHAR
)
RETURNS TABLE(id INT, email VARCHAR, display_name VARCHAR, handle VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id  INT;
    v_claimed  INT;
BEGIN
    INSERT INTO users (email, password_hash, display_name, handle,
                       verification_token, verification_token_expires_at)
    VALUES (p_email, p_password_hash, p_display_name, p_handle,
            p_verification_token, p_verification_expires_at)
    RETURNING users.id INTO v_user_id;

    IF p_invite_code IS NOT NULL THEN
        -- The `used_at IS NULL` predicate is the whole concurrency argument.
        -- Two registrations racing on one code both reach here; the first takes
        -- the row lock and marks it, and the second -- once the lock frees --
        -- re-evaluates the predicate against the committed row, matches
        -- nothing, and raises. One account, not two.
        UPDATE invite_codes
           SET used_at = NOW(), used_by_user_id = v_user_id
         WHERE LOWER(code) = LOWER(p_invite_code)
           AND used_at IS NULL;

        GET DIAGNOSTICS v_claimed = ROW_COUNT;

        IF v_claimed = 0 THEN
            -- Unknown and already-used are one error on purpose: telling them
            -- apart would let someone test codes against this endpoint.
            -- 22023 invalid_parameter_value, which nothing else on this path
            -- raises, so the controller can map it without matching messages.
            RAISE EXCEPTION 'invite code is not available'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN QUERY
    SELECT u.id, u.email, u.display_name, u.handle, u.created_at
      FROM users u
     WHERE u.id = v_user_id;
END;
$$;
