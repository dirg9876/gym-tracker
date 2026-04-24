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

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and
  Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure and conventions.
