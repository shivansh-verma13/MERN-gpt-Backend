# Briefcase API

The coordinated API for [Briefcase / MERN-gpt](https://github.com/shivansh-verma13/MERN-gpt/tree/upgrade/briefcase-v2), a private source-backed research workspace. Express, MongoDB, and strict TypeScript. Deploy both repositories at matching V2 revisions; legacy routes are incompatible.

## Quick start: synthetic demo

Node 22.12+:

```sh
npm ci
cp .env.example .env
npm run dev
```

Default port 5002, origin `http://localhost:5174`, JSON store `.data/demo.json`, registration disabled, no AI provider calls. Start the paired frontend and choose **Explore demo workspace**. JSON persists local synthetic data but is unsuitable for real-user production or multiple processes. `.env` and `.data` are ignored.

## Persistent accounts and live AI

Use a **new dedicated database**, never the legacy database:

```dotenv
STORE=mongo
MONGODB_URL=mongodb://127.0.0.1:27017
MONGODB_DB=briefcase_v2
DEMO_MODE=false
AI_PROVIDER=openai
OPENAI_API_KEY=server-only-secret
OPENAI_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=20
AI_GLOBAL_DAILY_LIMIT=100
AI_TIMEOUT_MS=25000
APP_ORIGIN=https://your-new-preview.example
NODE_ENV=production
WEB_DIST=./web
```

`AI_PROVIDER=demo` allows persistent accounts without paid generation, clearly labeled in the UI. Public synthetic demo plus OpenAI is rejected at startup. A missing live key fails startup instead of silently fabricating results. Configure a model supporting Responses structured outputs; see the [official guide](https://developers.openai.com/api/docs/guides/structured-outputs) and [Node SDK](https://github.com/openai/openai-node).

## AI implementation

`retrieval.ts` ranks bounded overlapping text chunks from at most 50 owner-scoped sources, selecting five excerpts of at most 800 characters. No vector service is justified for this release. Questions are standalone, not conversation rewriting.

`ai.ts` uses `responses.parse`, Zod, `store:false`, a configurable model, 1,000 output tokens, and zero automatic retries. Instructions treat source text as untrusted evidence; no tools exist. Quote text and source IDs must match retrieved context before saving an answer. No evidence abstains without a provider call. Refusal, malformed output, citation failure, cancellation, and timeout never save a partial turn.

Consent precedes sending the question and relevant excerpts. Account quota defaults to 20 attempts/day; global paid-call quota defaults to 100/day (configuration capped at 500). UTC quotas persist atomically in MongoDB and remain charged on failure to prevent retry abuse. Cancellation aborts the request but already-generated tokens can still cost money. Set a provider-side spending cap: token/request bounds cannot guarantee a precise dollar ceiling.

Quote validation proves provenance, not entailment or complete injection resistance. Lexical retrieval misses some paraphrases. Answers are fully validated before display, so unchecked streaming is intentionally omitted. Actual live model quality remains unverified without credentials.

## Security and API

- Salted scrypt passwords; opaque random sessions hashed in storage; HttpOnly/SameSite=Lax cookies, Secure in production, 24-hour expiry and MongoDB TTL.
- Exact-origin write checks, session CSRF header, Helmet, 100KB request bodies, bounded Zod validation.
- Owner authorization on every source/thread resource; foreign IDs return 404. No private source content is rendered as HTML.
- 10 auth requests/min/IP and 100 API requests/min/IP. These and in-flight locks are process-local: use one API replica. Review trusted-proxy configuration before relying on client-IP quotas; never blindly trust forwarded headers.
- Completed UUID question requests reuse answers. Conditional updatedAt writes prevent lost updates. Cross-replica duplicate provider requests are not guaranteed exactly once.
- Logs contain request IDs, method/status/duration, answer latency/token/citation totals; no intentional question, email, source, cookie, or key logging.

| Endpoint | Purpose |
|---|---|
| `GET /health`, `/api/config` | Storage readiness, public mode and limit |
| `POST /api/auth/register`, `/login`, `/demo` | Account or isolated demo session |
| `GET /api/auth/me`, `POST /api/auth/logout` | Resume/revoke session |
| `GET`, `POST /api/sources`; `DELETE /api/sources/:id` | Owner-scoped source operations |
| `GET`, `POST /api/threads`; `GET`, `DELETE /api/threads/:id` | Owner-scoped conversation operations |
| `POST /api/threads/:id/questions` | `{question, requestId: UUID, consent: boolean}` |

Signed-in writes require `X-CSRF-Token` from the session response and configured `Origin`. Responses are resources or `{items,hasMore}`; errors are `{error,fields?}`. Lists support `limit` (max 50) and `offset`. Product bounds: 50 sources × 16,000 characters, 100 conversations, 40 messages/thread. These are workload assumptions, not load-tested scale claims.

## Database and migration

`npm run migrate` creates idempotent version 1 indexes; startup also migrates. Collections: users, sessions, sources, threads, usage, migrations. Unique IDs/emails, owner/time indexes, session TTL, unique owner/day quotas follow actual queries. Connection pool 10, selection timeout five seconds; shutdown drains the server and closes storage.

**Deploy frontend and backend together.** V2 does not convert or delete legacy users/data. Back up the old database and keep it separate from `briefcase_v2`. Roll back both code revisions with their original manifests/database; retain V2 data for recovery. Index removal must be a reviewed operator action, never automatic destructive rollback.

## Checks and hosting

```sh
npm run lint
npm run typecheck
npm test
npm run evaluate
npm run build
npm audit --audit-level=moderate
npm start
```

Tests cover auth/ownership/CSRF, primary flows, limits, request reuse, consent, mocked provider success/failure/timeout, citation validation, global budget, and persistence. One test starts **real temporary MongoDB** for migrations, owner queries, conditional writes, atomic concurrent quotas, and reconnect persistence; first run downloads an official binary. Other API tests use JSON or provider mocks. Eight deterministic evaluation cases are not a live AI quality score.

Set `WEB_DIST` to built frontend assets for same-origin serving. `npm run prepare:web` optionally clones/builds the public frontend upgrade branch using `WEB_REF` (branch/tag) into `.release-web` and copies assets to `web`; it refuses an existing staging checkout. Direct local built assets are the verified route. Docker scaffold is supplied but unverified without a daemon.

Read [deployment](docs/DEPLOYMENT.md), [verification](docs/VERIFICATION.md), [case study](docs/CASE_STUDY.md), [priority backlog](docs/PROJECT_PRIORITY.md), and [upgrade log](UPGRADE_LOG.md). No hosted release is claimed. Missing: new HTTPS API host, persistent MongoDB, secret configuration, and optional provider key/spending cap. Existing portfolio hosting is unchanged.
