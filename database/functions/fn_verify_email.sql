-- Mark an address verified using a token that has not been spent or expired.
--
-- Three answers, not two (LOS-298):
--   a row with already_used = FALSE -- verified just now, caller mints a session
--   a row with already_used = TRUE  -- this exact link was used before
--   no rows                         -- unknown or expired token
--
-- The token is kept rather than deleted, stamped with used_at. That is what
-- makes the middle case knowable: a reader who opens the email twice, or whose
-- mail scanner follows the link first, can be told their address is already
-- confirmed instead of being sent round the resend loop (LOS-296). It leaks
-- nothing -- holding the token is proof of having received the email, and a
-- guessed one still falls through to no rows.
--
-- The replay case deliberately returns no user columns. The caller has no
-- session to mint from it, and nothing about the account travels back to
-- whoever presented a spent link.

-- Dropped rather than replaced: handle joined the result in LOS-248,
-- is_discoverable in LOS-251 and already_used here, and Postgres cannot change
-- a return type in place.
DROP FUNCTION IF EXISTS fn_verify_email(VARCHAR);

CREATE OR REPLACE FUNCTION fn_verify_email(
    p_token VARCHAR
)
RETURNS TABLE(
    id              INT,
    email           VARCHAR,
    display_name    VARCHAR,
    handle          VARCHAR,
    is_discoverable BOOLEAN,
    already_used    BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET email_verified_at          = NOW(),
        verification_token_used_at = NOW()
    WHERE verification_token = p_token
      AND verification_token_used_at IS NULL
      AND verification_token_expires_at > NOW()
    RETURNING users.id,
              users.email,
              users.display_name,
              users.handle,
              users.is_discoverable,
              FALSE;

    -- RETURN QUERY sets FOUND, so this asks whether the update matched.
    IF FOUND THEN
        RETURN;
    END IF;

    -- No expiry check here on purpose: a link used months ago still describes
    -- an account that is confirmed, and saying so is the helpful answer.
    RETURN QUERY
    SELECT NULL::INT,
           NULL::VARCHAR,
           NULL::VARCHAR,
           NULL::VARCHAR,
           NULL::BOOLEAN,
           TRUE
    FROM users u
    WHERE u.verification_token = p_token
      AND u.verification_token_used_at IS NOT NULL;
END;
$$;
