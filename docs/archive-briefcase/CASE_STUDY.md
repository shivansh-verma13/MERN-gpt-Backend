# Briefcase: from generic chat to a research workspace

## Problem and scope

The paired MERN-gpt repositories offered generic provider chat, outdated SDK calls, tightly coupled presentation, and growing chat arrays on user documents. The frontend failed its build and the API lacked meaningful tests.

A substantial refactor preserves React/Vite, Express/MongoDB, strict TypeScript, useful assets, and Git history. Old source is retained under `legacy/`. Switching frameworks or adding vector databases and queues would create cost before this workload justified them.

## Product improvements

Collect text sources, ask questions, inspect evidence, and revisit conversations. A distinctive cream/forest-green research desk replaces generic chatbot presentation. Synthetic project briefs support credential-free exploration and clearly disclose deterministic demo results.

## Decisions and trade-offs

- Separate sources, threads, sessions, and usage with owner-scoped authorization and indexed queries.
- Opaque sessions, CSRF, bounded inputs/lists, atomic account/global budgets, and reliable failure states.
- Five lexical excerpts for a bounded source library. Embeddings are future work only if measured misses justify them.
- Structured provider output and exact quoted citations validated before persistence. No unchecked streaming or autonomous tools.
- Consent, cancellation, request reuse, timeout, and token ceilings instead of a silent generic AI wrapper.
- One-origin hosting simplifies cookies/CORS. Deploy both repositories together because the API changed.

## Evidence

Five frontend tests, 13 backend tests including real temporary MongoDB, and eight deterministic evaluation cases pass. Chrome journeys verify persistence, citations, source operations, and responsive layouts. Current JavaScript is about 55KB gzip. No live model benchmark, user count, speed improvement, or hosted adoption is claimed.

Quote matching proves provenance, not entailment. Lexical retrieval can miss paraphrases; follow-up questions are standalone. Public live accounts need stronger anti-abuse/recovery controls. Hosting and actual OpenAI evaluation are pending.

## Portfolio-ready copy

**Briefcase — Source-backed research workspace**

Refactored a paired React/TypeScript and Express/MongoDB app into a private research workspace with persisted sources, conversations, and inspectable citations. Implemented server-side structured OpenAI integration, consent, cancellation, atomic usage budgets, owner authorization, and a clearly labeled credential-free demo. Verified mobile/desktop browser journeys, frontend/API tests, and real MongoDB integration behavior. Live provider and hosted deployment verification are pending.

## Next work

Configure a new HTTPS preview with persistent MongoDB. Evaluate the actual model on grounded questions, conflicting evidence, and injection attempts; improve retrieval against observed misses. Add account recovery/verification and demo cleanup before broad public access. Upgrade the NotePad pair next as a separate product.
