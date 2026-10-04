# Upgrade log — October 4, 2026

- Selected MERN-gpt + MERN-gpt-Backend after reviewing 34 public repositories and inspecting 15 candidate source trees.
- Substantial refactor; React/Vite, Express/MongoDB, assets, full Git history preserved. Old source under `legacy/`, excluded from runtime.
- Completed local acceptance: isolated demo; source create/search/view/delete; questions with inspectable evidence; saved conversations; cancel/failure states; strict owner checks; bounded usage; responsive UI; documentation.
- New source/thread/session/usage models, MongoDB migration v1 indexes and atomic quotas, opaque sessions/CSRF, structured OpenAI integration and explicit evidence-demo mode.
- Frontend five tests; backend 13 tests including real MongoDB; eight deterministic evaluations; lint/typecheck/build pass. Active dependency audit clean. Browser journeys and widths 320/375/768/1024/1440 verified.
- Actual live provider is unverified; provider success/failure/timeout uses mocks. No adoption, scale, performance improvement, or Lighthouse score claimed.
- Compiled same-origin release works locally at port 5003. No public deployment or existing production change. New HTTPS Node host + persistent MongoDB required. Docker scaffold unbuilt locally.
- Dedicated coordinated `upgrade/briefcase-v2` branches. Never deploy one side alone.
- Remaining: hosted preview, actual OpenAI evaluation, account verification/recovery, demo retention/reset, distributed controls if adding replicas.
- Next recommended: MERN-NotePadApp-Frontend + NotepadAppBackend. No other product modified.

## Checkpoint

Implementation is runnable; discovery need not be repeated. Read README and docs/VERIFICATION.md, DEPLOYMENT.md, PROJECT_PRIORITY.md. Select a new host and database, configure secrets, run matched builds/migration, and verify the entire hosted journey. Keep live AI evaluation separate from deterministic demo checks; preserve existing production.
