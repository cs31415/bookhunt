-- Readers a reader has favourited.
--
-- Also the permission model for messaging: only someone you have favourited
-- may reach you, so a two-way thread needs the pair to exist in both
-- directions. Un-favouriting is therefore how you block someone.
CREATE TABLE user_favorites (
    user_id          INT REFERENCES users(id) ON DELETE CASCADE,
    favorite_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, favorite_user_id),
    CHECK (user_id <> favorite_user_id)
);

-- The primary key covers "who has this reader favourited". This covers the
-- other direction, which is what the mutual check and any future "who
-- favourited me" both read.
CREATE INDEX idx_user_favorites_reverse ON user_favorites(favorite_user_id);
