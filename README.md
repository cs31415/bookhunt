# BookHunt

Personal book explorer app — search, curate a library, get AI-powered summaries and recommendations.

## Tech Stack

- **API**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (stored procedures, no ORM)
- **AI**: Claude API (summaries, themes, bookshelf scanning)
- **Search**: Google Books API
- **Storage**: AWS S3 (bookshelf photo uploads)
- **Auth**: JWT + bcrypt

## Project Structure

```
api/                    Node.js + Express API
  src/
    routes/             Slim wiring (Swagger docs + middleware + controller refs)
    controllers/        HTTP handling (req/res parsing, status codes)
    models/             Orchestration (coordinates data + external APIs)
    data/               Database access (pool.query wrappers)
    lib/                Shared clients (db, anthropic, s3)
    middleware/         Auth + rate limiting
database/              PostgreSQL schema + stored procedures
docs/                  API design, database design, implementation plan
scripts/               Dev utility scripts
assets/                Static prototype/design files
```

## Setup

```bash
cd api
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

## API Docs

Swagger UI is available at `/api/docs` when the server is running.
