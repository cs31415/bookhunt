CREATE TABLE authors (
    id         SERIAL PRIMARY KEY,
    slug       VARCHAR(255) UNIQUE NOT NULL,
    name       VARCHAR(255) NOT NULL,
    birth_year INT,
    country    VARCHAR(255),
    bio        TEXT
);
