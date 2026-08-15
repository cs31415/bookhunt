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
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Emails are lowercased by normalizeEmail() before they reach the database, but
-- the UNIQUE on the column above is case-sensitive while fn_find_user_by_email
-- matches on LOWER(email). That mismatch let A@b.com and a@b.com both register,
-- after which login returned whichever row Postgres yielded first. This index
-- closes it for every insert path, including psql and the scripts/ helpers.
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX idx_users_handle_lower ON users (LOWER(handle));
