# Strength progression

Selected by the user: WRPF, raw, drug-tested, open age division.
Supported level disciplines: barbell bench press, squat, deadlift. All three are
mandatory, regardless of favorites. This is an app comparison, not a awarded
federation title and NOT the sum-of-three powerlifting classification.

## Sources checked 2026-10-11

- Federation directory: https://wrpf.pro/razryadnye-normativy-wrpf-wepf-waf-wsf/
- Bench and deadlift: WRPF 2019 official document hosted by WSF,
  https://wsf-federation.ru/files/Normativy_WRPF_2019.pdf , pages 10-11 and 15-16.
- Squat table transcription (WRPF columns only, drug-tested male/female):
  https://frs24.ru/st/prisedaniya-so-shtangoj-normativ/ (marked valid for 2025).
  Original linked by WRPF: https://1drv.ms/b/s!AlqqNhFNdZxUhM1NDj9rjp1g0bh-Kg?e=j8Hemr

The current OneDrive documents and the federation viewer returned unavailable
(404). Thus these are versioned published tables, NOT a claim that a 2026 revision
has been verified. Squat was cross-checked against the existing repository MSMC
column. Keep source limitations visible; recheck originals before updating tables.
Age adjustments are not used. Open categories are 140+ male / 90+ female, not
fictional 150 kg / 110 kg categories. No interpolation between classes.

## App rules

- Official ranks use the exact published table values in EACH supported discipline.
- The original 81 game names are retained. Rank milestones are III at level 14,
  II at 27, I at 40, KMS at 54, MS at 67, MSMC at 80. Level 1 starts at 20 kg.
  Intermediate game steps bridge adjacent rank thresholds in kilograms, rounded
  up to 2.5 kg. They are not additional official ranks or percentages of MSMC.
- Recorded weight from finished workouts only; never estimated 1RM or tonnage.
- Other exercises contribute to workout statistics, not official ranks/levels.
- No automatic empty-bar/bodyweight passes, no 10-exercise skips or jump penalty.
- Actual per-exercise rank thresholds are table values, not percentages of MSMC.
- Time and repeated reads do not change a level. Deletion/profile changes can
  recalculate it; underlying workout history is never rewritten.
- Ordinary recreational training is expected to plateau below MSMC. Elite test
  fixtures are software boundary tests, not a training plan or expected timeline.

## Measurement rules

- All barbell set weights include the 20 kg bar. New sets below 20 kg are rejected;
  historical rows are preserved. Dumbbell weights refer to one dumbbell.
- Bodyweight exercises use repetitions and optional additional weight. Planks use
  explicit durationSeconds, with zero weight/reps/tonnage. Legacy plank rows without
  duration are displayed as unknown duration, never inferred from repetitions.
- Backup envelope v3 preserves durations and per-set workout templates; state
  version remains 1. Versions v1, v2 and v3 can be imported. Metadata is an offline extension,
  not a change to the independent web/backend API contract.

## Estimated accessory standards (user request, 2026-10-11)

Mobile lib/exerciseStandards.ts extends every catalog exercise with six targets.
Only bench/squat/deadlift are official WRPF comparisons. Accessory coefficients
are inherited from the repository's api-server/src/lib/sport-norms.ts, not claimed
to be independently validated or official. Each coefficient scales EACH published
rank threshold of its anchor, rounded up to 2.5 kg, minimum 20 kg for barbells.
Dumbbells are one-dumbbell weights. Machines vary by geometry and pulley ratio.
Custom exercises fall back to a muscle-group coefficient, explicitly identified.
These accessory targets do not replace the three mandatory lifts for game levels.

The user explicitly approved separate conditional seconds/repetition scales:
- Plank III/II/I/KMS/MS/MSMC labels: 30/45/60/90/120/180 seconds.
- Pull-up conditional base: male 5/8/12/16/20/25 reps, female 2/4/6/8/10/15 reps.
- Dips multiply that base by 1.5, narrow push-ups by 2, crunches by 3, hanging
  leg raises by 1.2, rounded up to a whole repetition. Unknown bodyweight: base x1.
These are deliberately conditional app benchmarks, NOT sports titles or physical
equivalence to WRPF. Best single completed set is used, never session totals.
