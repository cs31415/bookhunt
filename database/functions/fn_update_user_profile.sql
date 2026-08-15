-- Update the parts of an account a reader controls from settings.
--
-- COALESCE, so a caller sends only what changed -- except is_discoverable,
-- which cannot use that pattern: NULL would be indistinguishable from "make it
-- false", and false is exactly the value that takes a public page down again.
-- The controller therefore passes the flag only when the request carried it,
-- and p_set_discoverable says whether it did.
--
-- p_preferences is MERGED with ||, not assigned. preferences is one JSONB
-- document shared by every setting that will ever live there, so a caller
-- saving a theme must not silently drop a key it has never heard of (LOS-258).
--
-- Lets idx_users_handle_lower raise 23505 on a taken handle, the same way
-- fn_register_user does, so a rename and a sign-up fail identically.
--
-- Returns no rows when the id matches nothing, which cannot happen behind
-- authRequired but is the honest answer if it ever does.
DROP FUNCTION IF EXISTS fn_update_user_profile(INT, VARCHAR, VARCHAR, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION fn_update_user_profile(
    p_user_id           INT,
    p_display_name      VARCHAR DEFAULT NULL,
    p_handle            VARCHAR DEFAULT NULL,
    p_is_discoverable   BOOLEAN DEFAULT NULL,
    p_set_discoverable  BOOLEAN DEFAULT FALSE,
    p_preferences       JSONB   DEFAULT NULL
)
RETURNS TABLE(
    id              INT,
    email           VARCHAR,
    display_name    VARCHAR,
    handle          VARCHAR,
    is_discoverable BOOLEAN,
    preferences     JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE users u
    SET display_name    = COALESCE(p_display_name, u.display_name),
        handle          = COALESCE(p_handle, u.handle),
        is_discoverable = CASE
                            WHEN p_set_discoverable THEN p_is_discoverable
                            ELSE u.is_discoverable
                          END,
        preferences     = COALESCE(u.preferences, '{}'::JSONB)
                          || COALESCE(p_preferences, '{}'::JSONB)
    WHERE u.id = p_user_id
    RETURNING u.id, u.email, u.display_name, u.handle, u.is_discoverable, u.preferences;
END;
$$;
