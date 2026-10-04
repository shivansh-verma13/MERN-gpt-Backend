# Deployment and recovery

Current status: built same-origin local demo, no new hosted URL. Required external inputs: a Gemini API key for live AI, persistent MongoDB and a Node-capable host. Static Netlify deployment alone is insufficient for the API.

## Proposed preview

Deploy a new preview environment; do not overwrite the original MERN GPT or the owner's portfolio. Pin compatible `upgrade/interview-lab` commit SHAs in both repos. `npm run prepare:web` clones the frontend into `.interview-release-web`, installs/builds, and copies its dist into `web/`. Pin WEB_REF to a commit for reproducibility. The helper refuses to overwrite staging. Build the API with `npm ci && npm run build`, run `npm start` with WEB_DIST=./web, APP_ORIGIN=https://preview-host and NODE_ENV=production.

For an explicitly synthetic preview: DEMO_MODE=true, AI_PROVIDER=demo. Persist JSON on an attached volume, run one instance, and do not invite real private résumé uploads. A free ephemeral host resets JSON; disclose that before sharing. For real accounts: STORE=mongo, DEMO_MODE=false, dedicated MONGODB_DB=interview_lab_v1, AI_PROVIDER=gemini, server GEMINI_API_KEY. Keep limits at 10 requests/user/day and 30 live requests/day initially. These are call caps, not a currency budget. No paid resources have been provisioned; confirm host/database/provider free-tier eligibility and spending limits before enabling billing.

## Database

Startup and `npm run migrate` create versioned indexes idempotently. v1 legacy collections remain recoverable; v2 adds interview owner/createdAt, unique owner/createRequestId and ID indexes. Conditional updates include ownerId/version. No deletion or migration of old sources into interview content occurs. Prefer a fresh database; back up any existing target before explicitly authorizing a migration.

## Order and verification

1. Provision a dedicated database and preview environment with secrets on the server.
2. Build/pin frontend and API together. Set exact APP_ORIGIN and HTTPS cookies.
3. Run migrations in the dedicated target, health/readiness checks, then synthetic account creation and sign-in.
4. Start a session, answer 3 questions + optional follow-up, refresh/resume, download review, verify persistence after restart, check foreign-owner 404 and deletion.
5. Run live synthetic evaluation before inviting real users. Confirm privacy/retention disclosure.

## Rollback

Record deployed revisions and DB backup. Roll back both application revisions together. Leave additive interview indexes/collections intact unless a reviewed recovery procedure requires removal. Briefcase is recoverable at `upgrade/briefcase-v2`; it uses a separate session cookie and can use its original dedicated database. Preserve original MERN GPT history and legacy source. Never remove a production collection to rollback a code release.

## Operational limits

Single API replica; locks/IP limiter are in-memory. Daily quota reservation is atomic in Mongo but is deliberately not refunded on provider errors. Maximum 50 sessions per account. No automated retention policy, email verification, password recovery or admin deletion tooling. Monitor host logs (no contexts), provider usage, readiness and database backups. Provider cancellation cannot guarantee cancellation of an accepted remote request.


## Netlify release preparation — October 5, 2026

Added an Express-to-Netlify Functions adapter (`serverless-http`) with same-origin `/api/*` and `/health` rewrites plus static Vite output. Refactored startup into an async runtime factory; local Node server behavior is retained. Serverless runtime requires MongoDB, uses production secure cookies and reuses initialized connections per warm worker. Frontend build is pinned to ecee40d563798147b4120ebf0f1f64ccba99a444. No credentials enter Git, frontend assets or deployment config.

Verification: 16 backend tests pass, including serverless cookie serialization, sign-in identity, CSRF rejection, path normalization and base64 audio parsing. Build/lint pass and an ESM function bundle builds successfully. Dependency audit: 0 vulnerabilities. This verifies the adapter locally; Netlify cloud bundling and the hosted user journey remain pending.

Deployment plan: new `shivansh-interview-lab` project in the existing `shivansh-verma13` Netlify team, sourced from MERN-gpt-Backend `upgrade/interview-lab`; root base directory, build `npm run build && npm run prepare:web`, publish `web`, functions `netlify/functions`. Required runtime secrets: existing GEMINI_API_KEY and MONGODB_URL, plus STORE=mongo, MONGODB_DB=interview_lab_v1, DEMO_MODE=false, AI_PROVIDER=gemini, GEMINI_MODEL=gemini-3.5-flash-lite, NODE_ENV=production, AI_DAILY_LIMIT=10 and AI_GLOBAL_DAILY_LIMIT=30. APP_ORIGIN uses the site's platform URL or an explicit exact HTTPS origin. No WEB_DIST in serverless mode.

The local database/account records will be reused; startup creates existing additive indexes idempotently and deletes nothing. Rollback: restore the prior Netlify deploy/revision while retaining MongoDB data; existing Portfolio and original MERN GPT deployments are untouched. No paid plan or resource upgrade is authorized. Hosting consumes the team's existing build/function allowances; keep spending settings unchanged. Exact account allowances and cloud verification still need checking before publish.

Limitations: Netlify may use multiple workers. In-memory request locks/IP counters are best effort per worker, not distributed protection; MongoDB owner/version writes, unique replay indexes and atomic daily provider budgets remain authoritative. Not a claim of production scale or a public hiring service. Free-form audio input is bounded by bytes and timeouts; recording duration is bounded by the client, not independent server media decoding.

Blocker: explicit permission to transfer the existing Gemini API key and MongoDB connection credential into Netlify server environment variables. The browser's sensitive-data transmission policy requires naming the credentials and destination before transfer. Public URL must not be labeled verified until deploy and synthetic hosted journey pass. Next project remains Notes; no unrelated repository changes.
