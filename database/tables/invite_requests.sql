-- Someone asking to be let in (LOS-381).
--
-- Deliberately inert. Writing a row here sends nothing: not to the requester,
-- and not to the operator. A public form that mailed an invite would be the
-- vector LOS-376 closed, and worse -- an unauthenticated endpoint that makes
-- the server send mail to any address given, except now the mail carries a
-- working credential.
--
-- Codes are minted by hand afterwards, by someone who read the request.
CREATE TABLE invite_requests (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    -- What they said about themselves. Capped in the controller as well; this
    -- is the backstop.
    note        VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Set once the request has appeared in a digest. A flag rather than a
    -- created_at window, because a window silently loses requests whenever a
    -- run is missed -- a reboot, a deploy, a failed cron. With this, a missed
    -- day makes the next digest longer instead of losing a day of people.
    notified_at TIMESTAMPTZ
);

-- The digest reads exactly this: the ones not yet reported, oldest first.
CREATE INDEX idx_invite_requests_pending
    ON invite_requests (created_at) WHERE notified_at IS NULL;

-- No unique index on email, on purpose. Asking twice is what a person does when
-- nothing has happened, and refusing the second one would either leak that the
-- first exists or fail silently.
