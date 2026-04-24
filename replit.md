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
- 3 different "main" free-weight compound exercises (jim, squat, deadlift,
  rows, presses, curls — the canonical compound list in `MAIN_EXERCISE_NAMES`)
  each lifted at >= the level's benchmark weight in any single set, and
- a minimum total tonnage within any rolling 30-day window across finished
  workouts. Tonnage is sized as `5 ex × 4 sets × 8 reps × benchmark × 0.7 ×
  6 workouts/month`, rounded to 500 kg, so it scales realistically with
  expected training volume per workout.

Sprites: 9 tier sprites at `artifacts/gym-tracker/src/assets/levels/tier-N.png`
plus per-level overrides at `level-N.png`. The frontend `levelImage(level,
tier)` helper picks `level-N.png` if present, otherwise the tier sprite. The
`Levels` page shows the current avatar, the 3-exercise + tonnage progress to
the next level, and the full ladder of 81 levels.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and
  Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure and conventions.
