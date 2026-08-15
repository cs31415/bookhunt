-- True when no account holds this handle. Matches on LOWER to agree with
-- idx_users_handle_lower, so the answer given to the sign-up form is the same
-- answer the INSERT will give a moment later.
--
-- This is advisory only. Two people can pass this check at once and one of them
-- will still lose the INSERT, which is why the register path maps the resulting
-- 23505 to a 409 rather than trusting this.
CREATE OR REPLACE FUNCTION fn_is_handle_available(
    p_handle VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM users u WHERE LOWER(u.handle) = LOWER(p_handle)
    );
END;
$$;
