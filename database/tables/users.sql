CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    display_name          VARCHAR(255) NOT NULL,
    -- The public identity, and the whole of the URL at bookhunt.net/<handle>.
    -- Case is folded on the way in, so the unique index below is the real
    -- constraint rather than a second one that only catches exact matches.
    handle                VARCHAR(30) NOT NULL,
    preferences           JSONB DEFAULT '{}',
    is_discoverable       BOOLEAN DEFAULT FALSE,
    reset_token           VARCHAR(255) UNIQUE,
    reset_token_expires_at TIMESTAMPTZ,
    -- NULL until the address is proven. Login refuses an unverified account
    -- outright (LOS-218), so this is the gate, not a display flag.
    email_verified_at     TIMESTAMPTZ,
    verification_token    VARCHAR(255) UNIQUE,
    verification_token_expires_at TIMESTAMPTZ,
    -- The unlisted address (LOS-305). NULL means the reader has no share link,
    -- which is what "private" means once is_discoverable is off. Random and
    -- never derived from the handle or the id, so holding one tells you nothing
    -- about any other.
    share_token           VARCHAR(64),
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Emails are lowercased by normalizeEmail() before they reach the database, but
-- the UNIQUE on the column above is case-sensitive while fn_find_user_by_email
-- matches on LOWER(email). That mismatch let A@b.com and a@b.com both register,
-- after which login returned whichever row Postgres yielded first. This index
-- closes it for every insert path, including psql and the scripts/ helpers.
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX idx_users_handle_lower ON users (LOWER(handle));

-- The token is the whole credential, so two accounts must not share one. This
-- is also the lookup every visit to a shared page reads.
CREATE UNIQUE INDEX idx_users_share_token ON users (share_token);
