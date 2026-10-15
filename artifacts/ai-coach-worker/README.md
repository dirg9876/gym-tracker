# Gym-Beam Coach Worker

Production: https://gym-beam-coach.dirg9876.workers.dev

Cloudflare Workers Free confirmed by the owner on 2026-10-15. No paid hosting plan
enabled. OpenAI spend is separate, capped at $5 per UTC month by this gateway
using configured model prices. Free quotas can temporarily make AI unavailable.
[Cloudflare pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Runtime

- Worker gym-beam-coach; account ab718c47aa012fe9787a9d3541cc364d.
- SQLite Durable Object CoachObject, binding COACH, stable singleton name owner-v1.
- Shared provider/core/ledger with ../api-server/src/coach; no node:sqlite in Worker.
- nodejs_compat, compatibility_date2026-10-01, observability/preview URLs off.
- Secrets OPENAI_API_KEY and AI_COACH_OWNER_TOKEN, never bundled in the app.
- Public GET /healthz; authenticated GET /v1/coach/status and POST /v1/coach.

## Deploy

Node24 and pnpm required. Wrangler OAuth already authorized in the owner's system
store. Do not print or commit credentials. Run from this directory:

```powershell
pnpm test
pnpm typecheck
node scripts/deploy.mjs --publish --free-plan-confirmed
```

The helper uses .cloud-deploy/wrangler.json with frozen .cloud-deploy/seed.json.
Always use the helper for real deployment, not bare wrangler deploy/base config:
wrangler.jsonc deliberately lacks the bootstrap seed. Minified upload537.06KiB,
gzip128.72KiB. Dry-run build is not a deployment.

Frozen seed: month2026-10, usedNanoUsd1893100, reservedNanoUsd0. Captured after
stopping the local paid gateway. Keep this EXACT seed on all future deployments,
including later months: it is migration history, not today's budget snapshot.
Changing it fails closed. Privately back up generated state. If lost, recover the
exact seed; do not recapture today's local ledger.

Never reset Durable Object storage/namespace, migration or owner-v1. Never start
a separate paid Node gateway. ../api-server/.coach-data/cloud-cutover.json blocks
the old entry. Token rotation must preserve the same object, seed and ledger.

## Secrets

Edit private ../api-server/.env.coach and/or .coach-data/owner-token locally, then:

```powershell
node scripts/deploy.mjs --secrets --free-plan-confirmed
```

Secrets are read in RAM, sent through Wrangler stdin and redacted from captured
output. No plaintext secret file or secret argv. Do not echo secret values.
A rotated owner token requires reconnecting the app. AI_COACH_OWNER_TOKEN in
.env.coach takes precedence over owner-token; keep the phone credential consistent.
An OpenAI key must never go into the phone's owner-token field.

## Verification

8 actual Miniflare/workerd tests with mocked outbound API: auth/body bounds/caps/
cache/unknown reserves/restart persistence/immutable migration/concurrency.
No real secrets loaded. Miniflare5 needs convertV4MiniflareOptions and
resourcePersistencePath for persistent test storage.

Production health200/unauthorized401/authenticated200, carried spend$0.0018931,
one synthetic timed next-set API call and free cache replay all passed. Final
post-smoke spend$0.0022081, reserve0, limit5. Android emulator connects via HTTPS
with no local server/ADB reverse. AI/consent off; progress unchanged.

scripts/cloud-smoke.mjs --paid-once is opt-in and refuses to replace its existing
private report. Do not delete reports to silently repeat paid tests. Synthetic
context only; personal workout history was not sent to the model.

The new native gym-beam-autoconnect.apk stores the owner token with Android
Keystore (expo-secure-store); it restores settings after process death/updates.
One private connection-file import provisions the phone without typing secrets.
The token is not embedded in the APK or progress backups. The previous
gym-tracker-tested.apk remains RAM-only. See ../api-server/PHONE_SETUP.md for setup,
APK backup/signature caveats and current product limitations. Cloud API and its
durable ledger are unchanged by this mobile update; no additional paid calls.
