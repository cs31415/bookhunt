-- LOS-257: private messages. Idempotent; reload functions afterwards.
-- Private messages between two readers.
--
-- Delivery is polled, not pushed: the BFF proxies plain request/response, and
-- SSE or websockets there would be a large change for little gain at this
-- scale. So this table is read on an interval rather than written to a socket.
CREATE TABLE IF NOT EXISTS messages (
    id           SERIAL PRIMARY KEY,
    sender_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    read_at      TIMESTAMPTZ,
    CHECK (sender_id <> recipient_id)
);

-- The inbox: newest first for one recipient, and the unread count.
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at DESC);
-- One thread, both directions. Two indexes rather than one because a
-- conversation reads (a->b) and (b->a) as separate ranges.
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(sender_id, recipient_id, created_at);
