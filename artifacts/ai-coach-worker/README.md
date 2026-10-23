# Gym-Beam: Cloudflare Coach Gateway

Production: https://gym-beam-coach.dirg9876.workers.dev

Optional AI gateway for the Gym-Beam Android app. The diary and mathematical
workout planner run offline on the phone; this service checks plans and provides
coach analysis. A home computer is not required during a workout.

The owner selected Cloudflare Workers Free. Do not enable paid hosting implicitly.
Provider spend is separate, capped at $5 per UTC month by this gateway using
configured model prices. Free quotas can temporarily make AI unavailable.
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
wrangler.jsonc deliberately lacks the bootstrap seed. A dry-run build is not a
deployment and does not update the live service.

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

Run `pnpm test`, `pnpm typecheck` and `pnpm build` in this directory. The build
performs only a deployment dry run. Miniflare/workerd tests use a mocked provider
and isolated state to check authorization, request bounds, budget caps, cache,
unknown reserves, restart persistence, immutable migration and concurrency.
They do not load real secrets or make paid API calls.

`GET /healthz` and authenticated status do not call the model. Current spend and
reserves must be read from the live status, not copied from a historical smoke
report. Earlier migration verification is recorded in the
[cloud checkpoint](../../CHECKPOINT_CLOUD_2026-10-15.md).

scripts/cloud-smoke.mjs --paid-once is opt-in and refuses to replace its existing
private report. Do not delete reports to silently repeat paid tests. Synthetic
context only; personal workout history was not sent to the model.

## Android Connection

Gym-Beam stores the owner token with Android Keystore (expo-secure-store) and
restores the connection after process death and compatible updates. One private
connection-file import provisions the phone without typing secrets. The token
is not embedded in the APK or progress backups.

Use the APK from [GitHub Releases](https://github.com/dirg9876/gym-tracker/releases),
not an old local test build. See [phone setup](../api-server/PHONE_SETUP.md) and
the [coach guide](../../AI_COACH_GUIDE.md). Enabling AI allows the daily workout
preview to request a paid review automatically; connecting or reading status
alone does not call the model. Disabling AI leaves the offline diary available.
