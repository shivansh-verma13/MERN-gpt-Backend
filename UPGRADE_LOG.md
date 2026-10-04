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
