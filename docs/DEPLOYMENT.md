# Deployment and recovery

Current status (October 5, 2026): the hosted release is verified. See the verified hosted release checkpoint below for current architecture and limitations. Earlier checkpoints describe the resolved connection failure.

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

Earlier credential-transfer blocker resolved by explicit owner approval on October 5. See the hosted release checkpoint below for the current database connection blocker.

## Hosted release checkpoint — October 5, 2026

- Owner explicitly approved transferring existing Gemini API and MongoDB credentials to Netlify and deploying. Credentials are masked server environment values; none are in Git or frontend assets.
- New project: https://shivansh-interview-lab.netlify.app/ in shivansh-verma13, Free Legacy ($0), no paid resources, domain changes or Atlas access changes.
- Netlify builds the backend upgrade/interview-lab branch and a pinned frontend revision. Static publishing and cloud function bundling passed; deploy c6b0e15 / 6ac2a4f4d2d382000881d2c9 published successfully.
- Fixed production dev-dependency installation and repeated builds with isolated frontend staging checkouts. Scanner stays enabled for credentials; only public configuration constants are omitted from value matching.
- Readiness is blocked: GET /health returns 503. Privacy-safe function logs show function_initialization_failed, category database_connection after about 5 seconds (MongoServerSelectionError). Atlas network access is a likely cause, not yet confirmed. Atlas browser is signed out; owner login requested before inspection. Do not widen network access without explicit approval.
- Backend: all 16 tests pass, lint/build pass. Repeatable frontend release packaging against ecee40d563798147b4120ebf0f1f64ccba99a444 passed under NODE_ENV=production. Local Gemini/Atlas verification remains valid; no hosted AI success is claimed.
- Resume: inspect Atlas network access and cluster status after owner login; fix the confirmed blocker with appropriate authorization. Run work/verify-hosted-interview.mjs for real hosted questions, feedback, saved review, replay, HTTPS cookie and CSRF checks. Browser verify login/history/review plus audio consent/transcription; keep physical hardware and live browser speech service testing separate from synthetic tests.
- Then update this status, public portfolio project links and case study only after the hosted journey passes. No AI watermark or assistant attribution was added to commits. Next product remains Notes; do not start it yet.


## Verified hosted release — October 5, 2026

Earlier MongoDB deployment blockers are resolved. Live URL: https://shivansh-interview-lab.netlify.app/ . API: https://shivansh-interview-lab-api.onrender.com . Netlify proxies same-origin API requests to Render, preserving secure session cookies and CSRF validation. Render uses an Atlas user restricted to read/write on interview_lab_v1. Only the explicitly approved shared Render outbound ranges 74.220.52.0/24 and 74.220.60.0/24 were added; no all-IP rule was added. Secrets remain server-side.

Hosted verification used synthetic data: signup/login, real Gemini three-question interview plus one follow-up, exact feedback quote validation, UUID replay, MongoDB reload/history, Markdown export and missing-CSRF rejection all passed. A synthetic spoken WAV produced a real Gemini transcript; the interview version and answer count stayed unchanged until submission. The live browser rendered the saved review with no captured console warnings/errors and no horizontal overflow at its observed 552px viewport. Desktop/mobile responsive checks and simulated media/fullscreen checks were previously performed locally; the browser viewport override did not change the hosted browser's actual width. Physical camera/microphone and browser speech-service behavior still need owner device verification.

Checks: frontend lint/build passed; backend lint/typecheck/build and 18 tests passed; nine deterministic AI evaluation cases passed. GitHub Quality checks run 37229146025 passed after making the compiled runtime import lazy. No independent Sonar scan is claimed.

Free Render services sleep after 15 minutes idle and may take about a minute to wake. Public AI limits remain 10 requests/user/day and 30 requests/day globally; these are request limits, not a currency guarantee. Fullscreen interruption tracking cannot prevent help from another device. No paid resources, domain changes, assistant attribution or AI watermark were introduced.
