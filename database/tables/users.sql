CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    display_name          VARCHAR(255) NOT NULL,
    preferences           JSONB DEFAULT '{}',
    is_discoverable       BOOLEAN DEFAULT FALSE,
    reset_token           VARCHAR(255) UNIQUE,
    reset_token_expires_at TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);
