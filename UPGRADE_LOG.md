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
