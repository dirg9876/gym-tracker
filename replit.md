# Workspace

## Overview

pnpm workspace monorepo for "Тренировки" — a Russian-language gym workout tracker
with a button-driven set logger, history, personal records, and progress charts.

## Artifacts

- `artifacts/gym-tracker` — React + Vite frontend (mobile-first, dark theme)
  served at `/`. All UI strings in Russian.
- `artifacts/api-server` — Express 5 API server served at `/api`.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **TypeScript version**: 5.9
- **Frontend**: React 18, Vite, Tailwind v4, shadcn/ui, TanStack Query,
  framer-motion, recharts, wouter
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for the API server)

## Domain model

- `exercises` — catalog (built-in + custom). Russian names + muscle group.
- `workouts` — a session with `started_at` and optional `finished_at`.
- `workout_sets` — `(workout_id, exercise_id, weight_kg, reps, created_at)`.

The API derives totals (volume = weightKg × reps), per-workout summaries,
personal records (best tonnage, best reps, best max weight), per-exercise
records, progress series for charts, and overall stats overview.

## Levels

81 levels (0–80) defined statically in `artifacts/api-server/src/lib/levels.ts`.
Names go from insulting (Дохляк, Спичка) to respectful (Геркулес, Титан) as
level rises. Each level (>=1) requires both:
- 3 different **main** exercises (user-selectable via the star toggle on
  `/exercises`; flag stored in `exercises.is_main`) each lifted at >= the
  level's benchmark weight in any single set. On first run the original 11
  canonical compound names are seeded as `is_main=true` (see
  `seedMainExercisesIfEmpty`). The Levels page shows an amber hint linking
  to `/exercises` if fewer than 3 are marked, and
- a minimum total tonnage in the **last 30 days** (rolling window ending now).
  Tonnage is sized as `5 ex × 4 sets × 8 reps × benchmark × 0.7 ×
  6 workouts/month`, rounded to 500 kg.

Tonnage uses the *current* 30d window (not "max ever"), so the requirement
naturally resets if the user stops training: old sets fall out of the window
and the user can drop levels. The API also returns `bestLevelEver` (computed
from max-ever 30d tonnage) so the UI can remind users of their personal best
when they slack. `oldestSetInWindowAt` powers an hourglass hint showing how
many days until the earliest qualifying set expires.

Sprites: 9 tier sprites at `artifacts/gym-tracker/src/assets/levels/tier-N.png`
plus per-level images `level-0.png` … `level-80.png` (all 81 generated). The
frontend `levelImage(level, tier)` picks `level-N.png` if present, else the
tier sprite. Both the home page (level card) and `/levels` show the current
avatar plus 30-day progress to the next level.

## Programs

`/programs` (and `/programs/:id`) is a curated list of training programs
(chest day, back day, legs, shoulders, arms, push, pull, fullbody) defined in
`artifacts/api-server/src/lib/programs.ts`. Each program has a list of
exercises tagged `strength` / `hypertrophy` / `accessory`. The plan builder
(`buildProgramPlan`) suggests a working weight per exercise:
- If the user has a personal record for the exercise (heaviest single set in
  any finished workout), suggested weight = `PR × intentFactor`
  (`strength=0.8`, `hypertrophy=0.7`, `accessory=0.6`), rounded to 2.5 kg.
- Otherwise it falls back to a level-based benchmark: the planning level's
  `benchmarkKg` × an exercise-specific factor (`EXERCISE_BENCHMARK_FACTOR`)
  × the intent factor.
- Bodyweight exercises (pull-ups, dips, planks, etc.) suggest 0 kg unless
  the user already has a weighted PR, in which case they suggest added load.

Tapping "Начать «<program name>»" creates a workout via
`POST /api/workouts` with the program's name and routes to `/workout/:id`.
The plan is also stashed in `localStorage` keyed by workout id
(`gym-tracker:program-plan:<id>`) for future use. If an active workout
already exists, the button switches to "Открыть текущую тренировку" and
just navigates — it never overwrites the existing workout's plan.

## Live Workout Helpers

While inside `/workout/:id`, the logger now offers four assistants:

- **Auto-fill from program plan**: when the workout was started from a
  program, the first set selection auto-fills weight + reps from the stashed
  plan (`gym-tracker:program-plan:<id>`). After each successful add the next
  exercise's plan is queued automatically (mirrors mobile).
- **Previous performance card** (`PreviousSets`): fetches the user's last
  workout sets for the chosen exercise from `GET /api/exercises/:id/last-sets`
  and shows weight × reps plus a "повторить последний" button that fills the
  current weight/reps inputs.
- **Rest timer** (`RestTimer`): 60/90/120/180 s presets with a Web Audio
  beep + vibration when the rest ends. The component is keyed by
  `restTimerKey`, which bumps on every successful set add so the timer
  resets automatically.

## Insights & PWA

- **Strength card on Home** (`HomeStrengthCard`): shows the max-weight
  trajectory of the user's top exercise (skips when fewer than two data
  points exist).
- **Workout vs previous comparison** (`WorkoutComparisonPanel` on
  `/workout/:id/report` and history detail): backed by
  `GET /api/workouts/:id/comparison`, listing per-exercise volume / max
  weight deltas vs the prior finished workout.
- **Year heatmap** (`HeatmapCalendar` on `/stats`): year-long calendar grid
  rendered as inline SVG, fed by `GET /api/stats/heatmap?days=365`.
  Date strings are parsed with a local-time helper to avoid timezone shift.
- **Level forecast** (`LevelForecastCard` on `/levels`): shows estimated
  days to next level + confidence (`low`/`medium`/`high`/`achieved`),
  using `GET /api/stats/forecast` (regression based on the last-30 days
  tonnage trajectory).
- **PWA**: `vite-plugin-pwa` (autoUpdate) generates a manifest and service
  worker. `start_url` / `scope` follow the artifact's `BASE_PATH`. Runtime
  caching: NetworkFirst (5 s timeout) for `/api/*`, CacheFirst for Google
  Fonts, precache for the app shell. Icons are generated PNGs in
  `public/pwa-{192,512,maskable-512}.png`. SW is only registered in
  production via `registerSW({ immediate: true })`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and
  Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure and conventions.
