# Тренировки — Gym Tracker

A Russian-language gym workout tracker: button-driven set logger, history,
personal records, level / rank progression, and progress charts. Mobile-first
PWA web app, an Expo React Native mobile app, and an Express API, all in one
pnpm monorepo.

> Все строки UI — на русском. Этот README — на английском, чтобы было удобнее
> разбираться в коде на GitHub.

## Stack

- **Monorepo**: pnpm workspaces, TypeScript 5.9, Node.js 24
- **Web**: React 19, Vite, Tailwind v4, shadcn/ui, TanStack Query,
  framer-motion, recharts, wouter, `vite-plugin-pwa`
- **Mobile**: Expo SDK 54, React Native, expo-router
- **API**: Express 5, esbuild bundle
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (server + web + Expo)

## Layout

```
artifacts/
  api-server/         Express API (served at /api)
  gym-tracker/        React + Vite web app (served at /)
  gym-tracker-mobile/ Expo React Native app
  mockup-sandbox/     Component preview sandbox (canvas)
lib/
  api-spec/           OpenAPI source of truth + codegen target
  api-zod/            Zod schemas generated from the OpenAPI spec
  api-client-react/   Generated TanStack Query hooks (used by web + mobile)
  db/                 Drizzle schema + client
scripts/              Repo-level scripts (post-merge, etc.)
```

See the workspace conventions in `pnpm-workspace.yaml` and the per-package
`package.json` files for the full picture.

## Run it locally

Requires Node.js 24 and pnpm 10 (the lockfile is `lockfileVersion: 9.0`,
which is compatible with both pnpm 9 and 10).

```bash
# 1. Install deps
pnpm install

# 2. Copy env example and fill in real values (Postgres URL, Clerk keys, …)
cp .env.example .env

# 3. Push the Drizzle schema to your local Postgres
pnpm --filter @workspace/db run push

# 4. Start the API and the web app in two terminals
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/gym-tracker run dev

# Optional: regenerate the API client / Zod schemas after editing the spec
pnpm --filter @workspace/api-spec run codegen
```

> **Local API ↔ web connectivity.** The web app talks to the API at the URL
> baked in via `BASE_PATH` and Vite's `BASE_URL`. Running both on
> `localhost`, the simplest setup is `BASE_PATH=/` for the web app and
> `ALLOWED_ORIGIN=http://localhost:5173` for the API server (matches Vite's
> default dev port). On Replit both services share an origin via the
> built-in proxy, so this is only relevant outside Replit.

On Replit the four services run as workflows automatically:

- `artifacts/api-server: API Server`
- `artifacts/gym-tracker: web`
- `artifacts/gym-tracker-mobile: expo`
- `artifacts/mockup-sandbox: Component Preview Server`

## Useful scripts

- `pnpm run typecheck` — typecheck every package
- `pnpm run build` — typecheck + build every package
- `pnpm --filter @workspace/api-spec run codegen` — regen API hooks + Zod
- `pnpm --filter @workspace/db run push` — sync Drizzle schema to the DB

## CI

`.github/workflows/ci.yml` runs on every push and PR against `main`:

1. `pnpm install --frozen-lockfile` (pnpm 9, Node 24)
2. `pnpm run typecheck` — shared libs + every artifact (api-server,
   gym-tracker, gym-tracker-mobile, mockup-sandbox, scripts)
3. Build API server (`esbuild`) and web app (`vite build`,
   `PORT=8080 BASE_PATH=/`)

The Expo mobile app is typechecked but not built in CI (the Expo native
build needs additional credentials).

## Deployment

Publishing is done from Replit (Replit Deployments / Autoscale, see `.replit`),
not from GitHub. The GitHub mirror exists so the code is editable and reviewable
on github.com — every push that breaks `pnpm typecheck` or the web/API build
will fail CI before reaching Replit.

## More context

- `replit.md` — domain model, levels / sport rank system, programs, live
  workout helpers, PWA notes
- `.local/skills/pnpm-workspace/SKILL.md` — monorepo conventions
