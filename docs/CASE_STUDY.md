# Interview Lab — case study

## Problem

The original MERN GPT projects demonstrated basic authenticated chat, but an open-ended chatbot did not communicate a specific user journey. A research-workspace iteration (Briefcase) was completed first; the owner then selected interview practice as a more understandable, relevant product direction.

## Implemented release

A résumé/job-context setup, three text questions, one optional follow-up, formative evidence-backed feedback, saved private history, deletion and Markdown review export. Responsive layouts use paper/indigo surfaces and an understated editorial coaching panel. There are clear empty, loading, cancellation, failure and completion states.

## Decisions

Keep React/Vite and Express/Mongo rather than changing frameworks. Reuse secure sessions, owner-scoped storage and quotas from the previous iteration. Use an explicit state/version model so browser retries cannot duplicate completed answers. Add Gemini via the official server SDK so OpenAI credits are optional. Exact-quote validation rejects invented evidence, but neither the application nor its demo claims to verify technical correctness or suitability for a job.

A complete synthetic demo works without provider credentials. It is labeled template/rubric output throughout; live AI is implemented separately and requires consent. Text-first context makes the first release bounded; PDF extraction, audio, voice bots, coding execution and interview scheduling are deferred.

## Evidence and limitations

See VERIFICATION.md for actual test and browser results. There are no fabricated adoption metrics, hiring accuracy scores or live-model claims. Real model quality evaluation and hosted deployment await provider credentials and a persistent database/Node host. IP limits and in-flight locks assume one API replica.

## Portfolio copy

Interview Lab is a full-stack interview-practice product with résumé/job context, a bounded question-and-follow-up flow, saved sessions and answer-grounded formative feedback. Built with React, TypeScript, Express and MongoDB; includes a server-side Gemini adapter, consent, validated structured outputs, quotas and integration tests. The synthetic demo is verified locally; live AI and hosted deployment remain pending configuration.

## Next work

Verify Gemini against a small synthetic labeled evaluation set; review feedback relevance and incorrect technical advice manually. Deploy a bounded preview with HTTPS/Mongo, then verify account and practice persistence end to end. Add PDF ingestion only if users need it. Keep voice and coding execution out of this release.
