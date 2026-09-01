-- One code, good for one account (LOS-376).
--
-- Registration was open, and 64 of the 66 accounts it produced were bots
-- (LOS-363). Rate limiting was never the missing piece: the bot spaced its
-- signups 11-43 minutes apart, comfortably under the 10/hour cap. A filter is
-- something an adversary tunes against; a code it does not have is not.
CREATE TABLE invite_codes (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(64) NOT NULL,
    -- Who it was minted for, in words. Only ever read by a person.
    note            VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A code that never expires is a credential with no end date: one that
    -- leaks into a forwarded email or a screenshot works forever. NULL means
    -- no expiry, which mint-invite does not offer but a hand-written INSERT
    -- can, so the column does not force a decision it cannot inform.
    expires_at      TIMESTAMPTZ,
    -- Both NULL until claimed, and written together by fn_register_user.
    used_at         TIMESTAMPTZ,
    -- SET NULL rather than CASCADE: deleting an account should not erase the
    -- record that its code was spent. That matters immediately -- the 64 bot
    -- rows are due to be pruned, and taking the audit trail with them would
    -- make a spent code look unused.
    used_by_user_id INT REFERENCES users(id) ON DELETE SET NULL
);

-- Case-insensitive, because a code gets retyped from an email by a person.
CREATE UNIQUE INDEX idx_invite_codes_code_lower ON invite_codes (LOWER(code));
