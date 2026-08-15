-- Update the parts of an account a reader controls from settings.
--
-- COALESCE, so a caller sends only what changed -- except is_discoverable,
-- which cannot use that pattern: NULL would be indistinguishable from "make it
-- false", and false is exactly the value that takes a public page down again.
-- The controller therefore passes the flag only when the request carried it,
-- and p_set_discoverable says whether it did.
--
-- Lets idx_users_handle_lower raise 23505 on a taken handle, the same way
-- fn_register_user does, so a rename and a sign-up fail identically.
--
-- Returns no rows when the id matches nothing, which cannot happen behind
-- authRequired but is the honest answer if it ever does.
CREATE OR REPLACE FUNCTION fn_update_user_profile(
    p_user_id           INT,
    p_display_name      VARCHAR DEFAULT NULL,
    p_handle            VARCHAR DEFAULT NULL,
    p_is_discoverable   BOOLEAN DEFAULT NULL,
    p_set_discoverable  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    id              INT,
    email           VARCHAR,
    display_name    VARCHAR,
    handle          VARCHAR,
    is_discoverable BOOLEAN
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
                          END
    WHERE u.id = p_user_id
    RETURNING u.id, u.email, u.display_name, u.handle, u.is_discoverable;
END;
$$;
