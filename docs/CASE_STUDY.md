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


## Verified hosted release — October 5, 2026

Earlier MongoDB deployment blockers are resolved. Live URL: https://shivansh-interview-lab.netlify.app/ . API: https://shivansh-interview-lab-api.onrender.com . Netlify proxies same-origin API requests to Render, preserving secure session cookies and CSRF validation. Render uses an Atlas user restricted to read/write on interview_lab_v1. Only the explicitly approved shared Render outbound ranges 74.220.52.0/24 and 74.220.60.0/24 were added; no all-IP rule was added. Secrets remain server-side.

Hosted verification used synthetic data: signup/login, real Gemini three-question interview plus one follow-up, exact feedback quote validation, UUID replay, MongoDB reload/history, Markdown export and missing-CSRF rejection all passed. A synthetic spoken WAV produced a real Gemini transcript; the interview version and answer count stayed unchanged until submission. The live browser rendered the saved review with no captured console warnings/errors and no horizontal overflow at its observed 552px viewport. Desktop/mobile responsive checks and simulated media/fullscreen checks were previously performed locally; the browser viewport override did not change the hosted browser's actual width. Physical camera/microphone and browser speech-service behavior still need owner device verification.

Checks: frontend lint/build passed; backend lint/typecheck/build and 18 tests passed; nine deterministic AI evaluation cases passed. GitHub Quality checks run 37229146025 passed after making the compiled runtime import lazy. No independent Sonar scan is claimed.

Free Render services sleep after 15 minutes idle and may take about a minute to wake. Public AI limits remain 10 requests/user/day and 30 requests/day globally; these are request limits, not a currency guarantee. Fullscreen interruption tracking cannot prevent help from another device. No paid resources, domain changes, assistant attribution or AI watermark were introduced.
