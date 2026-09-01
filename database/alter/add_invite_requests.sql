-- LOS-381: let someone ask for an invite.
--
-- Inert by design: a row here sends nothing to anyone. A public form that
-- mailed an invite would rebuild the vector LOS-376 closed, with a working
-- credential in the message. Codes are minted by hand afterwards.
--
-- Idempotent; safe to run again.
--
-- No function reload is needed for this one on its own, but the endpoint that
-- writes it arrives with fn_create_invite_request, so:
--   psql -d <db> -f database/setup_functions.sql

CREATE TABLE IF NOT EXISTS invite_requests (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    note        VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invite_requests_pending
    ON invite_requests (created_at) WHERE notified_at IS NULL;
