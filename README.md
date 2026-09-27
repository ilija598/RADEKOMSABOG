# RADE KOMŠA — BOG MIDLEJNA

Vanilla JavaScript and Vite frontend with Cloudflare Pages Functions and Cloudflare D1. Serbian and English copy, lore, animations, the five-step challenger flow, five Anubis warnings and 300-second YES lock are retained.

## Install and configure

Use Node.js 22.12+ and npm. Run commands from the repository root.

```sh
npm install
npx wrangler login
npx wrangler d1 create rade-challengers
```

The repository is already configured for the created `rade-challengers` database, with migrations 0001?0005 applied on the current account. Skip database creation on this account. For a different Cloudflare account, create your own database and replace `database_id` in `wrangler.toml` with its returned UUID. Keep `binding = "DB"`, `database_name = "rade-challengers"` and `migrations_dir = "migrations"`. The UUID identifies the database; it is not a secret. Set `STEAM_API_KEY` as a Pages secret before deploying the SteamID version. Wrangler authentication is required for remote operations.

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

Existing databases: migrations already recorded as applied are not rerun when their file changes. Migration 0002 upgrades the original Steam-based table, preserving existing IDs, nicks, links, MMR and timestamps. It adds the reason and makes the legacy Steam link optional. Apply migrations in order; do not reset production data.

## API and storage

`POST /api/signup` accepts `Content-Type: application/json`:

```json
{"steamIdentity":"https://steamcommunity.com/id/sn0w98/","description":"I am worthy of mid.","mmr":5000,"immortalWorthy":"da","believesRadeMortal":"ne","betterThanRade":"ne"}
```

The server accepts a SteamID64, vanity name, or HTTPS Steam Community profile URL; it resolves these to a SteamID64 and looks up the current persona name using Steam Web API, requires a trimmed reason (maximum 500 characters), and requires an integer MMR from 0 through 20000. It uses a parameterized D1 INSERT and returns success only after the write finishes.

- Success: HTTP 200, `{"success":true}`.
- Invalid input: HTTP 400, `{"success":false,"error":"..."}`.
- Unexpected failure: HTTP 500, `{"success":false,"error":"Internal server error"}`.
- Unsupported methods return 405; cross-origin browser submissions return 403. Request bodies are bounded to 8 KiB.

New applications store SteamID64, the nickname returned by Steam, reason, MMR, all three answers, an automatic ID and creation time. Answers are required literal `da`/`ne` strings, independently of the UI language. Columns: `immortal_worthy`, `believes_rade_mortal`, `better_than_rade`. Migration 0003 removes `steam_link` and adds these CHECK-constrained columns. Existing applications retain NULL answers because those answers were never stored; new API submissions cannot omit them. The public `/challengeri` page lists applications through `GET /api/challengers`, paginated in batches of 50. Public fields are explicitly selected; future private database columns are never automatically exposed. Migration 0004 adds the permanent verdict timestamp. The browser retains an unfinished local draft and removes it only after confirmed success. A request timeout can mean the write completed; the client does not automatically retry.

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

## Public verdicts

Anyone can press YES on `/challengeri`; no login is required. `POST /api/challengers/:id/defeat` atomically sets `defeated_at` only when it is NULL. Repeated or simultaneous requests return the original timestamp without changing it. There is no public undo endpoint. The archive renders submitted text with `textContent`, not HTML. Both languages share the same verdict.

## Steam nickname lookup

The application accepts a numeric **SteamID64**, a vanity name such as `sn0w98`, or a full `https://steamcommunity.com/id/sn0w98/` or `/profiles/<SteamID64>/` URL. The Pages Function calls Steam `ISteamUser/ResolveVanityURL/v1` when needed, then `GetPlayerSummaries/v2` and stores the canonical SteamID64 and Steam's `personaname`. Set the secret before deploying this version:

```sh
npx wrangler pages secret put STEAM_API_KEY --project-name rade-komsa
```

Get a Steam Web API key at https://steamcommunity.com/dev/apikey while signed in. Paste the key into Wrangler's interactive prompt; never put it in Git or browser code. For local Wrangler testing, create a gitignored `.dev.vars` with `STEAM_API_KEY=...`. Migration 0005 has already been applied on the current Cloudflare account. On a new account, run `npx wrangler d1 migrations apply DB --remote` before deploying. Existing applications keep their stored nick and have no SteamID. A SteamID alone does not prove account ownership; Steam login would be a separate future step.
