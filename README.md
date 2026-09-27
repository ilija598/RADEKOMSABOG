# RADE KOMŠA — BOG MIDLEJNA

Vanilla JavaScript and Vite frontend with Cloudflare Pages Functions and Cloudflare D1. Serbian and English copy, lore, animations, the five-step challenger flow, five Anubis warnings and 300-second YES lock are retained.

## Install and configure

Use Node.js 22.12+ and npm. Run commands from the repository root.

```sh
npm install
npx wrangler login
npx wrangler d1 create rade-challengers
```

The repository is already configured for the created `rade-challengers` database, with both remote migrations applied. Skip database creation on this account. For a different Cloudflare account, create your own database and replace `database_id` in `wrangler.toml` with its returned UUID. Keep `binding = "DB"`, `database_name = "rade-challengers"` and `migrations_dir = "migrations"`. The UUID identifies the database; it is not a secret. No runtime secrets or submission-backend environment variables are required. Wrangler authentication is required for remote operations.

## Local development

Create the local database and build the frontend:

```sh
npx wrangler d1 migrations apply DB --local
npm run build
npm run dev:api
```

The last command runs `wrangler pages dev dist --port 8788`, serving the built site and real Pages Function with local D1 at http://localhost:8788. Local data remains under `.wrangler/state` and is separate from production.

For frontend hot reload, leave that terminal running and open another:

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Wrangler on port 8788. Vite alone cannot save applications: the Wrangler process and migrated local database must also be running. Rebuild to update the frontend served directly by Wrangler.

## Deploy to Cloudflare Pages

After configuring the real database UUID, apply the production migration:

```sh
npx wrangler d1 migrations apply DB --remote
```

Create the Pages project once (skip if it already exists):

```sh
npx wrangler pages project create rade-komsa --production-branch main
```

Build and deploy from the repository root so Wrangler discovers `functions/` and `wrangler.toml`:

```sh
npm run build
npx wrangler pages deploy dist --project-name rade-komsa --branch main
```

The D1 binding is declared in `wrangler.toml`; no separate Worker is needed. Do not upload only `dist` using dashboard drag-and-drop, because this project requires Pages Functions. Alternatively, connect the GitHub repository to Pages with build command `npm run build`, output directory `dist`, repository root as the root directory and Node.js 22.12+. Apply remote migrations before deploying code that needs them.

Existing databases: migrations already recorded as applied are not rerun when their file changes. Migration 0002 upgrades the original Steam-based table, preserving existing IDs, nicks, links, MMR and timestamps. It adds the reason and makes the legacy Steam link optional. Apply both migrations in order; do not reset production data.

## API and storage

`POST /api/signup` accepts `Content-Type: application/json`:

```json
{"steamNick":"xX_MidGod_420_Xx","description":"I am worthy of mid.","mmr":5000,"immortalWorthy":"da","believesRadeMortal":"ne","betterThanRade":"ne"}
```

The server trims the nick (required, maximum 100 characters), requires a trimmed reason (maximum 500 characters), and requires an integer MMR from 0 through 20000. It uses a parameterized D1 INSERT and returns success only after the write finishes.

- Success: HTTP 200, `{"success":true}`.
- Invalid input: HTTP 400, `{"success":false,"error":"..."}`.
- Unexpected failure: HTTP 500, `{"success":false,"error":"Internal server error"}`.
- Unsupported methods return 405; cross-origin browser submissions return 403. Request bodies are bounded to 8 KiB.

New applications store nick, reason, MMR, all three answers, an automatic ID and creation time. Answers are required literal `da`/`ne` strings, independently of the UI language. Columns: `immortal_worthy`, `believes_rade_mortal`, `better_than_rade`. Migration 0003 removes `steam_link` and adds these CHECK-constrained columns. Existing applications retain NULL answers because those answers were never stored; new API submissions cannot omit them. There is no public endpoint for reading challengers. The browser retains an unfinished local draft and removes it only after confirmed success. A request timeout can mean the write completed; the client does not automatically retry.

The five-minute lock is a client-side joke, not an anti-spam guarantee. No CAPTCHA or distributed rate limiter is included.

## Checks and structure

```sh
npm test
npm run build
```

Tests cover validation, the exact API contract, parameterized writes, safe failure handling, frontend request behavior, bilingual content and the existing challenger interactions.

```text
src/layout.js                       Shared bilingual markup
src/challenger-form.js              Form state, draft and animations
src/signup-api.js                   JSON submission and response handling
src/validation.js                   Pure validation
src/content/sr.js, en.js            Editable copy and lore
functions/api/signup.js             Pages Function using env.DB
migrations/                        Initial schema and compatible reason upgrade
wrangler.toml                      Pages and D1 configuration
```

Deployment references: [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/).
