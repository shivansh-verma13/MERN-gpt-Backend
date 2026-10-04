# Interview Lab

A text interview practice product built by Shivansh Verma. Bring résumé/experience text and a job description, practice three role-specific questions with at most one follow-up, then review your answers and actionable feedback. This evolves the original MERN GPT project into a complete, bounded product.

**Status:** local end-to-end demo verified. Live Gemini and Atlas-backed account interviews verified locally with synthetic data. No hosted release URL is claimed.

The actual UI screenshots are in the paired frontend repository.

## Product journey

1. Open the explicitly labeled synthetic demo, or sign up in a Mongo-backed account deployment.
2. Choose target role, experience level, and frontend/backend/full-stack focus.
3. Paste résumé and job context; optionally import résumé `.txt` / `.md` (64KB and 10,000 character limits). PDF parsing is outside this text-first release.
4. Answer three primary questions, with up to one clarifying follow-up. There is no countdown or hiring score.
5. See feedback with exact excerpts from your answer, resume saved sessions, and download the completed review as Markdown.
6. Use history to revisit or delete a session after confirmation.

Demo questions are templates; feedback is a deterministic local text rubric. It checks answer detail, verification wording, and trade-off wording, **not technical correctness**. Demo requests use the real API and persistent local storage; no AI calls are made. Use synthetic context in public demos.

## Architecture

- React 18 + TypeScript + Vite, plain CSS design tokens, Lucide icons.
- Express + TypeScript, MongoDB for real accounts; local JSON only for explicit synthetic demos.
- Opaque hashed session cookies, scrypt passwords, exact-origin write checks and CSRF tokens.
- `@google/genai` for Gemini structured outputs; optional OpenAI Responses adapter retained.
- Three-question state machine, one-follow-up cap, request UUID replay protection and conditional version writes.
- Owner-scoped bounded history, per-user and global daily request budgets, timeout/cancellation, no automatic provider retries, 1,400 output-token cap.

Paired repositories: [frontend](https://github.com/shivansh-verma13/MERN-gpt/tree/upgrade/interview-lab) and [API](https://github.com/shivansh-verma13/MERN-gpt-Backend/tree/upgrade/interview-lab). Both use `upgrade/interview-lab`; deploy compatible revisions together. Legacy application source stays under `legacy/` where already preserved. The prior research product remains recoverable on `upgrade/briefcase-v2` and its documentation is archived in `docs/archive-briefcase/`.

## Local setup

Node.js 22.12+ and npm. Clone both repositories and check out `upgrade/interview-lab`.

```sh
# API repository
npm install
cp .env.example .env
npm run dev
# Frontend repository, separate terminal
npm install
npm run dev
```

Visit `http://localhost:5174`. The frontend proxies `/api` to port 5002. Use `localhost` consistently and keep `APP_ORIGIN=http://localhost:5174`; changing origins requires changing the server allowlist. For the frontend preview on port 4174, adjust APP_ORIGIN or use the same-origin release below.

## Environment and AI

The frontend has **no provider credentials**. Set server variables in the API `.env` (never commit it):

| Variable                         | Purpose / default                                                 |
| -------------------------------- | ----------------------------------------------------------------- |
| `PORT`, `APP_ORIGIN`             | 5002 and exact browser origin                                     |
| `STORE`, `DEMO_MODE`             | `json-demo`, `true` for synthetic local mode                      |
| `DEMO_FILE`                      | `.data/interview-demo.json`; persistent local demo file           |
| `MONGODB_URL`, `MONGODB_DB`      | Required for real accounts; dedicated `interview_lab_v1` database |
| `AI_PROVIDER`                    | `demo`, `gemini`, or `openai`                                     |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server key and `gemini-3.5-flash-lite` default                    |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional adapter, `gpt-4o-mini` default                           |
| `AI_DAILY_LIMIT`                 | 10 requests per user/day, including question preparation          |
| `AI_GLOBAL_DAILY_LIMIT`          | 30 live attempts/day across users                                 |
| `AI_TIMEOUT_MS`                  | 25,000ms; startup bounds maximum to 30,000ms                      |
| `WEB_DIST`                       | Optional built frontend directory, e.g. `./web`                   |
| `NODE_ENV`                       | `production` requires HTTPS for Secure session cookies            |

For Gemini: create a key in [Google AI Studio](https://aistudio.google.com/apikey), put it only in the API environment, set `STORE=mongo`, `DEMO_MODE=false`, `AI_PROVIDER=gemini` and configure a dedicated Mongo database. Public synthetic demo mode deliberately refuses live AI configuration. Free-tier availability and terms depend on the account and model; verify them before enabling billing. Gemini free-tier content may be used to improve Google products. The UI requires explicit consent before sending résumé, job context and answers. Remove personal or employer-sensitive information.

Structured results are validated with Zod. Question context quotes and feedback quotes must be exact substrings of supplied context/answers. Strengths require evidence. This reduces fabricated citations; it **does not prove** reasoning, technical correctness or semantic support. Prompt instructions constrain untrusted content, and there are no tools/external actions. Cancellation stops local work; a provider may still process or bill an already accepted request. Failed live attempts consume budget conservatively. Logs contain request IDs, status, latency and token counts, not raw contexts or answers.

## Verification

```sh
# Both repos
npm run lint
npm run typecheck
npm test
npm run build
# API only
npm run evaluate
```

See [verification](docs/VERIFICATION.md) for results and limitations. Policy/rubric evaluation is deterministic, not a live model quality benchmark. Tests use synthetic data and injected provider responses for failure paths.

## Same-origin build and deployment

```sh
# API repo after pushing the matching frontend revision
npm run prepare:web
npm run build
# Set APP_ORIGIN to your HTTPS host, WEB_DIST=./web, then
npm start
```

`WEB_REF` can pin an immutable frontend commit; the Docker build exposes the same argument. The helper refuses to overwrite its staging checkout. Review the checked-out revision before release. Use a low-cost Node host with a persistent Mongo database and HTTPS; static frontend hosting alone cannot serve this backend. One API replica is the documented workload assumption: in-flight locks and IP limits are process-local. Multi-replica coordination, password reset/email verification and retention automation are not implemented. No production adoption or load capacity is claimed.

Migration v2 adds interview owner/time and create-request uniqueness indexes without deleting historical research collections. Prefer a new dedicated database. Back up any existing database and consult [deployment/recovery](docs/DEPLOYMENT.md) before a live migration. No existing production domain or database was changed during this upgrade.

## Structure

Frontend: `src/components/PracticeSetup.tsx`, `PracticeSession.tsx`, `PracticeReview.tsx`, `Auth.tsx`; `App.tsx` owns navigation/session loading, `api.ts` transport, `types.ts` contracts and `styles.css` the design system.

API: `src/interview.ts` schemas/state/rubric, `interview-routes.ts` ownership and flow, `interview-provider.ts` server adapters, `app.ts` auth/middleware, `store.ts` JSON/Mongo storage, `index.ts` startup, `tests/` integration tests and `scripts/evaluate.ts` validation cases.

[Case study](docs/CASE_STUDY.md) · [Upgrade log](UPGRADE_LOG.md) · [Original project prioritization](docs/PROJECT_PRIORITY.md)
