# Upgrade log — Interview Lab, October 4, 2026

- Owner explicitly selected Interview Lab to replace the Briefcase research direction in the same MERN-gpt / MERN-gpt-Backend pair.
- Preserved Git history, legacy source and recoverable `upgrade/briefcase-v2` branch. Previous docs archived; original project discovery retained and current selection updated. No unrelated project modified.
- New coordinated `upgrade/interview-lab` branches; main/master and existing production unchanged.
- Completed bounded acceptance: role/level/focus + résumé/job context; text import; 3 questions and up to 1 follow-up; saved answer-grounded feedback; resumable private history; confirmed deletion; authenticated Markdown export.
- Indigo/paper responsive interface; semantic forms, consent, empty/loading/error/cancel states, inert mobile navigation, reduced motion.
- Official Gemini server SDK plus optional OpenAI adapter; keys server-only. Explicit local template/rubric demo; no mocked output represented as AI.
- Schemas reject invalid plans and invented quotes; unsupported strengths require evidence. Versioned ownership-conditional writes, replay IDs, in-flight locks, bounded history/caps, daily budgets, timeouts, cancellation and privacy-safe logs retained/refined.
- Additive Mongo v2 interview indexes; old source/thread data preserved. No live destructive migration performed.
- Verification: 7 frontend / 12 backend tests; real MongoMemoryServer 7.0.14; 9 deterministic cases; both lint/typecheck/build/install pass; active dependency audits 0 vulnerabilities. Browser complete practice/refresh/API restart/export verified; 6 responsive widths; axe 0 violations for setup/review desktop/mobile.
- Deployment: compiled same-origin local demo on port 5004; no new hosted URL. Docker scaffold not built locally. Same-origin packaging helper verified against frontend commit ea0e492bb71f5098f76797ff0e97674e1b7e3d26; packaged UI starts an interview against the compiled API.
- Blockers: Gemini key + real synthetic AI quality review; persistent Mongo and HTTPS Node preview host. No paid resources or production updates requested/performed.
- Known limits: one API replica, text only, formative feedback not technical verification, no password recovery/email verification/automatic retention.
- Next recommended project: MERN-NotePadApp-Frontend + NotepadAppBackend; wait for owner instruction before modifying it.

## Checkpoint

Read README, docs/VERIFICATION.md and docs/DEPLOYMENT.md. Continue from the coordinated Interview Lab branches; do not redo discovery or restore Briefcase as active UI. Configure Gemini via a server secret and a dedicated database, run synthetic live evaluation, then deploy and verify the complete journey in a new preview. Keep existing production and historical database recoverable.

## Live Gemini configuration check

The owner supplied a key, saved only in the API ignored `.env`. Two direct synthetic provider requests passed using gemini-3.5-flash-lite: 3-question plan (357 tokens) and feedback with 2 exact answer excerpts (606 tokens). The prior gemini-2.5-flash-lite returned 404 for the new account, so the default was updated. This verifies live structured output and quote validation, not model quality or a hosted/account browser journey. Public demo remains local rubric only; real account UI still requires MongoDB. No billing settings were changed. Earlier missing-key statements above describe the initial checkpoint.

## Atlas-backed live journey verified

The owner authorized creation of the new dedicated interview_lab_v1 database. Atlas connectivity and additive index migration passed; initial database had no collections. Credentials are only in the ignored API .env. Local startup now uses STORE=mongo, DEMO_MODE=false and AI_PROVIDER=gemini at localhost:5004.

A synthetic browser account completed 3 live questions + 1 live follow-up with consent, answer-grounded feedback and saved review. Review persisted after refresh and API restart. Authenticated Markdown export returned 200 with attachment and live disclosure. No page errors observed. Test account signed out; owner can create their own app account. This verifies the live local flow, not hiring accuracy or hosted deployment. Public HTTPS hosting remains pending; no billing settings changed.


## Audio, video and fullscreen simulation

Four formats: text, audio, video and fullscreen simulation. Browser speech synthesis reads questions; a replay button is available. Audio recording is bounded to 2 minutes per answer and a 4 MB API upload. With separate explicit consent, the server sends audio to Gemini and validates an editable transcript. Transcription shares the existing per-user and global daily request budgets; a full spoken round can use 7–9 requests including question generation and feedback. Errors retain the local clip for retry; cancellation and device cleanup are supported. Local/demo mode never calls a provider. OpenAI-only configuration currently supports typed feedback, not transcription.

Camera preview and optional per-answer video recording stay in the browser. A local video download must be saved before leaving the room. Video recordings are bounded to approximately 20 MB / 2 minutes and never uploaded. Raw audio is transiently buffered for provider processing and is not stored in MongoDB; edited answers and interruption events are persisted. Google provider data policies still apply to audio sent for transcription.

Simulation requests fullscreen through a user action and requires camera/microphone permission. Exiting fullscreen, hiding the page or losing a media track pauses answering; resuming requires another user action. Start/exit/return, page-hidden, window-blur and device-loss events are bounded, owner-authorized and deduplicated. These are untrusted client signals, not proof of cheating. There is no gaze tracking, face analysis, screen capture or guarantee against external assistance. The API checks client-reported device/fullscreen state; a modified client can bypass those assertions. Event syncing is best effort, with a visible manual retry; unsynced events may be lost when leaving the page.

Requires HTTPS or localhost, supported MediaRecorder formats and device permissions. Some mobile browsers do not support fullscreen; use audio/video practice in that case. Permissions are requested only after a visible action. Camera and microphone stop when leaving the room.

Verification: 10 frontend tests (media devices/fullscreen mocked), 15 backend tests including real MongoMemoryServer, lint and production builds pass. Live authenticated Gemini transcription of a synthetic SAPI spoken sentence returned the expected text in 2,031 ms (one local sample, not a benchmark). Chrome used synthetic canvas/audio streams to verify actual fullscreen entry, exit, pause, resume, native MediaRecorder, local video download (85,598 bytes), and Atlas-persisted interruption events. Physical camera/microphone quality and Safari/mobile OS support still need owner-device testing. No new public deployment or dependencies.

Final browser layout checks passed at 320, 375, 430, 768, 1024 and 1440 px with no horizontal overflow. Axe reported 0 violations in the media room; its video-caption manual check applies to the muted local preview, which contains no audio playback. Physical-device verification remains pending.


## Horizontal studio UX — October 5, 2026

Fixed the format-picker grid on its actual card container: four horizontal desktop choices, two columns on tablets and one column on narrow phones. The interview room puts the question and editable transcript on the left and camera/controls on the right; mobile stacks the panels. Camera/microphone permissions are requested automatically when a media room mounts, while unsupported/denied permissions retain a retry control. Simulation still needs a user gesture for fullscreen and keeps questions locked until fullscreen is active. Device tracks are released on navigation.

Optional browser SpeechRecognition provides interim captions and appends final recognized words to the editable answer. It starts only after the separate audio-processing opt-in and pauses during question speech, recording, feedback submission, fullscreen interruptions and navigation. Browser recognition may send audio to its own external speech service; it does not call the configured Gemini key. Unsupported browsers retain consent-based Gemini clip transcription and typed answers. Browser-service errors offer retry/fallback, not fake transcripts. Physical microphone accuracy and live browser-service connectivity remain unverified.

Verification: 12 frontend tests pass, lint and production build pass. Browser verified four equal desktop cards, one automatic media request per mounted room, camera stream assignment, native fullscreen entry, left-side interim/final rendering using a synthetic speech adapter, and track cleanup on navigation. Studio checked at 320/375/430/768/1024/1440 px with no horizontal overflow; axe 0 violations (muted preview caption manual check remains). No dependency or API contract changes; backend's prior 15-test suite remains applicable. Local preview refreshed at localhost:5004; no public deployment.


## Netlify release preparation — October 5, 2026

Added an Express-to-Netlify Functions adapter (`serverless-http`) with same-origin `/api/*` and `/health` rewrites plus static Vite output. Refactored startup into an async runtime factory; local Node server behavior is retained. Serverless runtime requires MongoDB, uses production secure cookies and reuses initialized connections per warm worker. Frontend build is pinned to ecee40d563798147b4120ebf0f1f64ccba99a444. No credentials enter Git, frontend assets or deployment config.

Verification: 16 backend tests pass, including serverless cookie serialization, sign-in identity, CSRF rejection, path normalization and base64 audio parsing. Build/lint pass and an ESM function bundle builds successfully. Dependency audit: 0 vulnerabilities. This verifies the adapter locally; Netlify cloud bundling and the hosted user journey remain pending.

Deployment plan: new `shivansh-interview-lab` project in the existing `shivansh-verma13` Netlify team, sourced from MERN-gpt-Backend `upgrade/interview-lab`; root base directory, build `npm run build && npm run prepare:web`, publish `web`, functions `netlify/functions`. Required runtime secrets: existing GEMINI_API_KEY and MONGODB_URL, plus STORE=mongo, MONGODB_DB=interview_lab_v1, DEMO_MODE=false, AI_PROVIDER=gemini, GEMINI_MODEL=gemini-3.5-flash-lite, NODE_ENV=production, AI_DAILY_LIMIT=10 and AI_GLOBAL_DAILY_LIMIT=30. APP_ORIGIN uses the site's platform URL or an explicit exact HTTPS origin. No WEB_DIST in serverless mode.

The local database/account records will be reused; startup creates existing additive indexes idempotently and deletes nothing. Rollback: restore the prior Netlify deploy/revision while retaining MongoDB data; existing Portfolio and original MERN GPT deployments are untouched. No paid plan or resource upgrade is authorized. Hosting consumes the team's existing build/function allowances; keep spending settings unchanged. Exact account allowances and cloud verification still need checking before publish.

Limitations: Netlify may use multiple workers. In-memory request locks/IP counters are best effort per worker, not distributed protection; MongoDB owner/version writes, unique replay indexes and atomic daily provider budgets remain authoritative. Not a claim of production scale or a public hiring service. Free-form audio input is bounded by bytes and timeouts; recording duration is bounded by the client, not independent server media decoding.

Earlier credential-transfer blocker resolved by explicit owner approval on October 5. See the hosted release checkpoint below for the current database connection blocker.

Netlify UI verification: existing GitHub app already exposes MERN-gpt-Backend; no new repository permission was granted. Project name shivansh-interview-lab is available. Form prepared on upgrade/interview-lab with the build/publish/function directories above; not submitted. Team billing confirms Free Legacy ($0), no payment method, 300 build minutes/month and 100 GB bandwidth. No plan/add-on changes made. Awaiting explicit credential-transfer authorization before runtime secret entry and deploy. Configuration screenshot saved as a user-facing output.

## Hosted release checkpoint — October 5, 2026

- Owner explicitly approved transferring existing Gemini API and MongoDB credentials to Netlify and deploying. Credentials are masked server environment values; none are in Git or frontend assets.
- New project: https://shivansh-interview-lab.netlify.app/ in shivansh-verma13, Free Legacy ($0), no paid resources, domain changes or Atlas access changes.
- Netlify builds the backend upgrade/interview-lab branch and a pinned frontend revision. Static publishing and cloud function bundling passed; deploy c6b0e15 / 6ac2a4f4d2d382000881d2c9 published successfully.
- Fixed production dev-dependency installation and repeated builds with isolated frontend staging checkouts. Scanner stays enabled for credentials; only public configuration constants are omitted from value matching.
- Readiness is blocked: GET /health returns 503. Privacy-safe function logs show function_initialization_failed, category database_connection after about 5 seconds (MongoServerSelectionError). Atlas network access is a likely cause, not yet confirmed. Atlas browser is signed out; owner login requested before inspection. Do not widen network access without explicit approval.
- Backend: all 16 tests pass, lint/build pass. Repeatable frontend release packaging against ecee40d563798147b4120ebf0f1f64ccba99a444 passed under NODE_ENV=production. Local Gemini/Atlas verification remains valid; no hosted AI success is claimed.
- Resume: inspect Atlas network access and cluster status after owner login; fix the confirmed blocker with appropriate authorization. Run work/verify-hosted-interview.mjs for real hosted questions, feedback, saved review, replay, HTTPS cookie and CSRF checks. Browser verify login/history/review plus audio consent/transcription; keep physical hardware and live browser speech service testing separate from synthetic tests.
- Then update this status, public portfolio project links and case study only after the hosted journey passes. No AI watermark or assistant attribution was added to commits. Next product remains Notes; do not start it yet.
