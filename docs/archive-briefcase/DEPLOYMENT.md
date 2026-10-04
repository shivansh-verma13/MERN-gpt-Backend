# Deployment and recovery

## Recommended topology

One **new HTTPS Node 22 preview** serves Express `/api` and built Vite assets through `WEB_DIST`, backed by a dedicated persistent MongoDB database. Start with one API replica. Do not replace existing production or the Portfolio Netlify site.

1. Check out both reviewed `upgrade/briefcase-v2` revisions.
2. Frontend: `npm ci`, `npm run build`.
3. API: `npm ci`, `npm run build`. Copy frontend `dist` contents to API `web`; alternatively `npm run prepare:web` clones/builds a public frontend branch/tag selected with `WEB_REF`. Both the direct asset path and clone/build helper were verified locally.
4. Set server variables: `STORE=mongo`, dedicated `MONGODB_URL`/`MONGODB_DB`, exact HTTPS `APP_ORIGIN`, `NODE_ENV=production`, `WEB_DIST=./web`, and host-provided `PORT`.
5. Public credential-free preview: `DEMO_MODE=true`, `AI_PROVIDER=demo`. Each visitor receives isolated synthetic data and provider spending is disabled. Cap is 200 workspaces; arrange reviewed synthetic cleanup. Private accounts: `DEMO_MODE=false`. Live AI additionally needs server credentials, configured model, account/global ceilings, and provider spending cap.
6. Run `npm run migrate` against the new database, keep backups, then `npm start`. No legacy database is modified/imported.
7. Verify health, HTTPS cookies, onboarding, source save/refresh, citations, logout, and second-account ownership denial. Before advertising live AI, verify actual structured output, timeout, quotas, and model evaluations.

## Split hosting

Netlify needs a `/api/*` reverse proxy **before** the SPA fallback, an existing compatible API, and matching API origin. Verify cookies and cancellation through the proxy. Do not expose secrets in Vite or switch to cross-site cookies to disguise missing infrastructure.

## Container scaffold

The API Dockerfile builds both sides, copies only runtime dependencies/server/web assets, and runs as a non-root user.

```sh
docker build --build-arg WEB_REF=upgrade/briefcase-v2 -t briefcase:v2 .
docker run --env-file .env -e WEB_DIST=/app/web -p 5002:5002 briefcase:v2
```

**Not Docker-verified**: no local daemon is available. Use a persistent authenticated database, never ephemeral storage for real users. Production cookies require HTTPS. Keep `.env` out of Git/images.

## Costs and blockers

No new resource, charge, domain, or hosted release was created. Costs depend on the chosen host, region, database plan, and AI model; verify free-tier compatibility before provisioning. Missing: selected new HTTPS API host, dedicated persistent MongoDB secret, origin, and optional OpenAI key/spending cap. These block hosted verification, not the completed local product.

## Rollback and operations

Keep old frontend/API commits and the original database. V2 uses a new database and preview URL. If it fails, stop the preview and restore both old revisions with their original manifests/database. Retain V2 data for recovery. Never drop collections/remove indexes automatically. Back up V2 before later migrations.

Configure log retention and alerts for 5xx, timeouts, quota exhaustion, and health failures. Review trusted-proxy topology and client IP limits on the selected host. Do not claim horizontal safety until process-local locks/limits are replaced and tested.
