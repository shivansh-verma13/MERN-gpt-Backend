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
