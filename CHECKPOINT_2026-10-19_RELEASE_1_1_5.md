# Gym-Beam 1.1.5: Larger Portraits, Training Insights, Next-Level Gaps

## Status And Goal

**COMPLETE**, 2026-10-19 Europe/Moscow. Workspace `C:\gymbeam`, PowerShell. User requested larger level characters, useful infographic statistics and an explicit distance to the next GAME LEVEL in addition to the next sport rank. Implementation, tests, native QA, APK and OTA publication/application, and exact original progress comparison all PASS. No required app/release work remains.

- App source on established `master`: **9ed081c367f7217bc8dda71de2ee01a04be2c6e1**.
- Exact-source CI SUCCESS: https://github.com/dirg9876/gym-tracker/actions/runs/39168712977.
- Release **1.1.5**, Android versionCode **11**, native-compatible runtime **1.1.0**. Bumped ONCE via `pnpm release:patch --notes-file ../../docs/releases/v1.1.5.notes.json --date 2026-10-19`; `release:check` PASS. Explicit client date was needed because host UTC/emulator were still October 18. Emulator timezone was not changed.
- Completion documentation is a later docs-only commit. It does NOT need another app bump, APK build or OTA publication. Next completed logical app release: **1.1.6**.

## Decisions And Behavior

- Existing pixel images, characters, captions and male/female mapping retained. No image generation or PNG edits. Female gallery/text remains unchanged. Current native portrait is **192 dp** at widths >=400 dp, otherwise **160 dp** (previously 100); collapsed ladder **96 dp** (previously 48); expanded selected portrait **216 dp**. Existing common 6% male framing inset retained. Current character name is below the portrait/level row, full width, to fit larger system text.
- Levels show explicit next-game-level target and remainder in kg, repetitions or seconds. Passed goals are green. Missing results are unknown, not invented zero progress. Sport/calculated rank and its separate remainder stay below in quieter text. Expanded ladder steps show their selected level's requirements. Existing numeric progression, WRPF norms and any-three-exercises rule are unchanged.
- Assisted exercises clarify computed load = body mass minus counterweight; a gap means more effective load, NOT more counterweight. Optional read-only `loadMode` added to level API results, not persisted.
- Statistics periods: **28 days / 12 weeks (84 days) / all time**. Completed sessions, performed sets, unique active days, and comparison with the previous equal period. Local-date calendar; sets by week and primary muscle group; searchable exercise-specific progress with actual set/date and link to that completed History workout.
- Weight, reps, hold seconds and counterweight have separate appropriate scales. Bodyweight defaults to repetitions; all-zero added-weight curves are hidden. Unknown legacy hold time is explicitly unknown, not zero seconds. No fictitious strength estimates, calories, recovery predictions, streaks or overall tonnage added.
- Session date follows History's `startedAt`; local calendar arithmetic is DST-safe. Active, future and corrupt sessions excluded. Archived exercise history retained. Multiple sessions on one day count one active/group day. All-time totals, groups and exercise history are NOT capped at 50 workouts. All-time calendar/weeks use explicitly dated last 84 days; exercise graph last 24 points is explicitly labelled. Empty periods show one honest empty message, not redundant blank charts.
- Entire feature is local, read-only and usable with AI OFF. `coachRequest` here calls the existing offline API, not the provider. No backend/schema/native dependency/migration changes, no private data sent, no paid AI calls, backup format remains 9.

## Files

Mobile root: `artifacts/gym-tracker-mobile`.

- `app/(tabs)/levels.tsx`: three enlarged portrait sites, responsive framing, separate game/rank gaps, assisted-load labels.
- `app/(tabs)/stats.tsx`: period controls, totals/comparisons, calendar, weekly/muscle bars, exercise picker, metric graph/history link, empty/error/retry/loading/refresh states. Stable two-line summary-label heights at larger font scale; proper Russian plural for 84 days.
- `components/TrainingCalendar.tsx` (new), `BarChart.tsx` (optional formatter/details/colors with existing default kg behavior), `LineChart.tsx` (stable single-point height, date-proportional spacing, grid/ticks, tap/accessibility selection, unique gradient IDs).
- `lib/trainingInsights.ts` (new pure aggregation), `lib/chartGeometry.ts` (new guarded geometry), `lib/levelProgress.ts` (`exerciseLevelGoal`), `lib/offlineApi.ts` (read-only `GET /api/stats/insights?days=28|84|all` and level `loadMode`). Existing SVG/charts/picker/segmented-control conventions reused.
- `scripts/training-insights.test.mjs`, `scripts/chart-geometry.test.mjs` (new), `scripts/level-gallery.test.mjs`, `scripts/testHarness.mjs`.
- `app.json`, `release.json`, root `AGENTS.md`, `CHECKPOINT.md`, this checkpoint, `docs/releases/v1.1.5.md`, `docs/releases/v1.1.5.notes.json`.

## Verification

- **281 tests PASS**: mobile 235 + design 19 + API 17 + Worker 10. Workspace typecheck and final native TypeScript PASS. `release:check` and `git diff --check` PASS. Exact-source CI PASS.
- Twelve new tests: nine insights/level-gap tests and three chart geometry tests. Cover active/future exclusions, local/DST boundaries, previous periods, all 120 historical sessions, deletion/archive/read-only behavior, same-day counts, kg/reps/seconds/counterweight, unknown records/time, game versus rank targets, proportional date spacing and single/zero/same-date/invalid geometry. DST tests run isolated Node child processes to avoid Windows cached default timezone effects.
- Existing female baseline guard PASS: 81 labels and 90 original asset hashes unchanged. All raw male/female PNGs unchanged.
- Built ONLY with `scripts/build-release.ps1`, fresh embedded Expo manifest verified. Final build log `artifacts/apk/verified/release-1.1.5-build-delivery-empty.log`: SUCCESS, 54 sec / 835 tasks. Original signing certificate retained. Multiple QA iterations stayed within this one logical release/code.
- Private exact-value scan PASS: 20 staged source/docs files, 1448 decompressed final APK entries, 204 fresh OTA export files. Actual provider/owner values checked in memory, never printed or embedded. No credentials, backups, connection files, APK Git blobs, SDK or AVD files staged.

## Native QA And Progress Safety

Protected original AVD **gymbeam_test / emulator-5554**:

- Freshly verified original state: 2 finished workouts / 8 sets / confirmed level 3 / 0 active; nextWorkoutId 11, nextSetId 15; original profile unchanged. Never imported fictional data or restored an archived backup here. Existing AI remains OFF, gateway unchanged; no provider calls.
- Final APK installed with `adb install -r`, without uninstall. Enlarged current male portrait, game-level-4 gaps **2.5 kg / 5 kg** distinct from sport-rank **17.5 kg / 52.5 kg**, green passed exercise and Stats **2 sessions / 8 sets / 2 days** PASS.
- Fresh backup `before-release-1.1.5-native.json`, fresh second baseline `before-release-1.1.5-final.json`, post-APK `after-release-1.1.5-install.json` and post-published-OTA `after-release-1.1.5-published-ota.json`: **state + plans exactly equal** using Node `assert.deepEqual`. Each 13842 bytes; export metadata may differ. Private files ignored under `artifacts/apk/verified`, NOT committed.
- Actual published OTA downloaded via **Обновления > Проверить обновления**, then **Применить обновление**. Running Updates page verified **Gym-Beam 1.1.5 / Обновление 01a150f6**, not just successful upload. Stats/portraits/gaps rechecked after OTA. Manual **Что нового** displays correct dated 1.1.5 notes; acknowledged popup did not repeat on same-version OTA or cold restart.
- Final cold start on Home shows **Начать тренировку**, no active workout. Current app PID log has no ReactNativeJS/AndroidRuntime errors. No ADB reverse; no Metro/dev server needed. Primary AVD left running for user, original resolution/density/font/timezone preserved.

Isolated QA AVD **gymbeam_visualqa / emulator-5556**:

- Generated/imported validated fictional history only here: 16 finished sessions / 144 sets over 84 days, barbell/dumbbell/bodyweight/plank/assisted machine. Generator `artifacts/apk/verified/make-insights-fixture.mjs` and fixture `release-1.1.5-fictional-progress.json` are ignored diagnostics, not production/user data. First draft correctly failed timed-set RIR validation; fixture corrected to null, actual backup parser then PASS.
- 28 days 8/72/8 versus previous 4/36/4; 84 days and all time 16/144/16 PASS. Tap selected actual Sept 28 counterweight 25 instead of latest Oct 18 counterweight 15; history link opened the Sept 28 workout, back returned to Stats. Plank 53 seconds, pullups 8 reps; no fake kg or useless zero-load graph.
- Regular and 360x640 dp / fontScale 1.3 screenshots inspected: portraits, row/expanded previews, period controls, calendar/chart interactions, aligned summary labels, female existing portrait, empty history. No incoherent overlap. Empty history tested by clearing ONLY verified QA AVD, never primary.
- QA resolution/density/font reset, AVD stopped. Gradle daemon stopped. No remaining required exec sessions.

Screenshots/logs remain ignored at `artifacts/apk/verified/release-1.1.5-*`, including `ota-applied`, `ota-notes`, `ota-stats`, `ota-levels`, `ota-gap`, `ota-home`, earlier mixed-unit/expanded/small/empty captures and test/build/export logs.

## Published Artifacts

- Release: https://github.com/dirg9876/gym-tracker/releases/tag/v1.1.5.
- APK: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.5/gym-beam-1.1.5.apk. Verified public HTTP 200, not draft, GitHub uploaded digest and size equal local final file.
- Local final APK: `artifacts/apk/verified/gym-beam-1.1.5.apk`, **152520435 bytes**, SHA256 **D6C420161493900CB3678254DF7963E2E7227FC3E5206A6859A73A985EACD729**. `aapt`: com.dirg9876.gymtracker, 1.1.5/code11, arm64-v8a + x86_64. Original certificate SHA256 **dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a**. Older candidate hashes/builds are superseded; do not publish them.
- Fresh final Expo export: `artifacts/gym-tracker-mobile/dist/_expo/static/js/android/entry-d8fa796db1b37a37eedcf2c11b494fad.hbc`, about 5.19 MB; log `release-1.1.5-export.log`. Never use the earlier bf3f candidate bundle.
- EAS project `dirg9508/gym-tracker-mobile`, projectId **dabd3128-415f-4a2f-8c73-3b0a52585149**, Android branch/channel **production**, runtime **1.1.0**.
- OTA group **1a0f2cad-b84d-412b-bbe9-cdb3ca466ed8**; Android update **01a150f6-f7d2-7411-8323-bc6d029d33f8**; published 2026-10-18T21:42:05.010Z from source **9ed081c367f7217bc8dda71de2ee01a04be2c6e1**. Manifest https://u.expo.dev/update/01a150f6-f7d2-7411-8323-bc6d029d33f8. One new JS bundle uploaded; existing assets reused.
- Publish command from mobile: `pnpm dlx eas-cli@16.32.0 update --branch production --platform android --message "Gym-Beam 1.1.5: larger portraits and training insights" --skip-bundler --input-dir dist --environment production --non-interactive --json`. Windows `npx ENOENT` config warning followed by established @expo/config fallback is harmless; publication and actual device update verified.

## Constraints, Limitations And Next Step

- Physical phone/iOS not tested; native QA used existing Android AVDs and current dark theme. No claim of new research/medical advice. Muscle chart counts primary muscles only. Historical equipment mode follows existing enrichSet/current exercise behavior, not a new immutable equipment migration.
- Pre-existing Android import preview sometimes shows content-provider ID (fixture `msf:20`) rather than filename. Isolated import was verified by selected file plus 16/144 counts/AVD identity; preview naming not changed in this release.
- Unrelated `.agents/agent_assets_metadata.toml`, mockup sandbox generated component, untracked older checkpoints and `attached_assets/*` were left untouched/uncommitted. Never revert user changes.
- On phone finish active workout, open **Обновления > Проверить обновления > Применить обновление**. Compatible installed APK needs no reinstall. Alternatively install signed APK above over current app without uninstall. Export external progress backup before replacing any very old/differently signed build.
- Next: no repeat generation/build/publication needed. Await user feedback. Next logical app change uses **1.1.6** and fresh Russian release notes, keeping runtime 1.1.0 ONLY if native-compatible. Always export CURRENT primary progress before future tests; never restore these older backups over newer user workouts.

## Local Tooling For Continuation

- Node: `C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; pnpm: `C:\Users\Dirg9\AppData\Local\pnpm\pnpm.CMD`. Prepend both directories to PATH for commands.
- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe`. Existing account authenticated; don't print credentials. Commit identity can use per-command `-c user.name=dirg9876 -c user.email=273524213+dirg9876@users.noreply.github.com`, not global changes. Push with gh directory in PATH, `GIT_TERMINAL_PROMPT=0`, `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin master`; no force push.
- JDK17 `C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`; SDK `C:\gymbeam\artifacts\android-sdk`; AVD_HOME `C:\gymbeam\artifacts\android-avd`. Use repository release build script, preserve signing key.
- Native helpers: `artifacts/gym-tracker-mobile/scripts/android-ui-helpers.ps1`. Set `ANDROID_SERIAL` BEFORE dot sourcing. `Read-Ui` may need retry for transient null dump after navigation; inspect current UI before tapping again. `Export-Backup` creates external file and pulls to ignored QA directory. Never automate taps concurrently on same AVD.
- Recheck exact data by parsing fresh backup JSON and `assert.deepEqual(after.state,before.state)` plus `.plans`; do not compare changing export metadata. No private values need to be read or printed to continue.
