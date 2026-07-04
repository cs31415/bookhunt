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
src/
  routes/             Slim wiring (Swagger docs + middleware + controller refs)
  controllers/        HTTP handling (req/res parsing, status codes)
  models/             Orchestration (coordinates data + external APIs)
  data/               Database access (pool.query wrappers)
  lib/                Shared clients (db, anthropic, s3)
  middleware/         Auth + rate limiting
database/              PostgreSQL schema (tables/ and functions/) with setup scripts
docs/                  API design, database design, implementation plan
scripts/               Dev utility scripts
assets/                Static prototype/design files
```

## Database Setup

```bash
psql -d <your_database> -f database/setup_tables.sql
psql -d <your_database> -f database/setup_functions.sql
```

Each table and function lives in its own file under `database/tables/` and `database/functions/`. The setup scripts include them in dependency order.

## Setup

```bash
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

## Scripts

Dev utility scripts live in `scripts/`. They read config from `scripts/.env`.

```bash
cd scripts
cp .env.example .env
# Fill in your credentials in .env
```

| Script | Description |
|---|---|
| `test-create-user.js` | Creates a test user via the API |
| `test-photo-import.js` | Imports bookshelf photos for a user |
| `wipe-user.js` | Deletes a user and all associated data |

Run with `node scripts/<script>.js` from the repo root.

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # re-run on file changes
```

Tests live in `src/tests/` mirroring the source structure:

| Suite | Coverage |
|---|---|
| `middleware/auth` | `authRequired`, `authOptional` — valid token, missing/invalid header |
| `controllers/auth` | `login`, `register`, `forgot-password` — happy path, error cases |
| `controllers/library` | `get-library` |
| `controllers/ai` | `search` — validation, sorting, `inLibraryOnly`, unauthenticated |
| `models/library` | `get-library`, `add-to-library` |
| `models/ai` | `search` — Google Books mapping, limit clamping, library matching |
| `data/auth-data` | All four functions — stored procedure args |
| `data/library-data` | All six functions — stored procedure args |

## API Docs

Swagger UI is available at `/api/docs` when the server is running.
