# Gym-Beam 1.1.7: Exercises Without An Archive

## Status

**COMPLETE**, 2026-10-20 Europe/Moscow. Workspace `C:\gymbeam`, PowerShell. Source **bc3543ccb4fab9d50bdcc7658a7717b9d7d223ee** pushed to established `master`. Exact-source [CI39493809595](https://github.com/dirg9876/gym-tracker/actions/runs/39493809595) SUCCESS. GitHub APK and production Android OTA published, applied and verified. No remaining release work; do NOT repeat publication/build/artifact generation.

Version **1.1.7 / Android code13 / native runtime1.1.0**. Runtime unchanged: no native APIs, dependencies or compatibility-affecting config changed. Next completed logical app release is **1.1.8**, not another1.1.7 rebuild. Documentation-only completion does not need a new app version.

Previous1.1.6 cinema release remains complete, source1c9d061; its legacy-offline verification/completion docs committed762bb87 and pushed along with this release. Newest request, implementation and final answer concern EXERCISE REPLACEMENT, not the older art task.

## Goal And User Decision

User: remove all archived exercises, offer replacement by existing or new exercises, leave no archive. Explicit clarification: **transfer old sets and records to the chosen exercise**, rather than keep their original names only in history. Preserve real measurements, offline history, backup safety and optional AI. Never silently guess equivalence between different movements.

## Behaviour And Decisions

- DELETE permanently removes an exercise with no sets/monthly-plan references. It also removes unused future custom-type/current-plan entries and clears related draft/timer, as before. No new deletedAt tombstones.
- If any recorded sets or saved AI-month references exist, deletion requires replacement (409). Catalog trash opens the replacement workflow directly. No deletion of recorded progress.
- Replacement offers compatible existing exercises or creation of a prefilled new exercise. New exercise creation AND transfer are one journaled transaction, not two operations that can leave an orphan.
- Compatibility requires equal equipment, timed/repetition semantics, assistance mode and dumbbell count. Same-group choices sort first; this does NOT certify two machines/movements are equivalent. Confirmation asks the user to choose the same movement and warns records merge and level is recalculated for the destination.
- Transfer remaps all sets, saved types, current workout plans, saved AI month/profile references, draft, timer and transferred sourceTimer. Recorded weights/reps/seconds/body-mass snapshots/RIR/technique/set IDs/dates survive. Active draft revision changes to reject stale writes.
- Duplicate exact targets merge without losing weights/approaches. Mixed generic/exact duplicate type entries reject with actionable409; choose a separate new replacement or specify exact targets first. Duplicate monthly blocks merge up to existing six-target cap; overflow409 preserves everything and offers a separate replacement/change of month.
- Destination pending-review flag is cleared after explicit selection. The any-three level rule counts a merged destination ONCE, never as two distinct exercises. Combining two different recorded IDs may lower the distinct-exercise count or change rank thresholds; this is deliberate, with a warning.
- Legacy deletedAt is accepted only as old input. Unused tombstones are purged automatically. Entries with sets/monthly references become ACTIVE, visible exercises with replacementPending=true and a Home/catalog review action. They are available until the user chooses a replacement, not a hidden archive. No arbitrary automatic mapping of real results.
- Archive flags/labels removed from mobile statistics, levels and backup summary. Current-state exercises have no deletedAt. Old external backup files are not deleted or rewritten.
- Backup format remains structurally compatible v9; versions1-9 accepted. ORIGINAL file checksum is verified before canonical migration; migrated returned/exported state gets its own checksum. Stored migration uses existing durable journal; a storage fault rolls back without quarantining valid progress.
- No provider/model/AI connection/budget/consent/Worker changes or paid calls. Coach remains optional and OFF on the protected AVD.

## UI Bug Found And Fixed

Native soft keyboard covered the old editor footer save button. First1.1.7 candidate was superseded, never published. ExerciseEditor save is now a fixed-header check icon with the exact accessible command label (including «Создать и перенести»), busy/disabled states. Footer save removed. Header save works WHILE the soft keyboard is visible on regular and360dp/font1.3 screens. Android native adjustResize unchanged; KeyboardAvoidingView remains iOS-only; modal gesture root and handled keyboard taps retained. This is a JS-only compatibility-safe fix, not a native window/config change.

Creating a replacement is a full screen plus the existing editor modal, not nested confirmation modals. Existing selection has one consequence-confirmation dialog. Search is scrollable with keyboard taps retained.

## Source Files

Source commit changes28 scoped files:
- `AGENTS.md`, `CHECKPOINT.md`, this checkpoint; AGENTS currentrelease1.1.7.
- Mobile `app.json`, `release.json`; bumped ONCE via release:patch/date2026-10-20. Final Russian notes include archive removal, transfers, header save and legacy migration.
- New `lib/exerciseReplacement.ts`: shared compatibility/maintenance types and legacy migration.
- `lib/offlineApi.ts`: new maintenance/replacement endpoints, hard deletion, atomic remapping; `progressBackup.ts`, `levelProgress.ts`, `trainingInsights.ts`.
- New `app/exercise-replacement.tsx`; catalog `app/exercises/index.tsx`; Home/levels/stats/backup/layout; `components/ExerciseEditor.tsx`.
- New `scripts/exercise-replacement.test.mjs` and synthetic-only `exercise-replacement-qa.mjs`; changed testHarness and five existing suites to new deletion semantics.
- `docs/releases/v1.1.7.md` and `v1.1.7.notes.json`.

Offline endpoints: GET /api/exercises/maintenance; POST /api/exercises/:id/replace with EITHER {targetExerciseId:number} OR {exercise:newFields}. Existing DELETE remains idempotent for previously allocated removed IDs. New routes use existing offline handler, not the AI gateway. Shared generated OpenAPI/server/web contracts were not changed.

Unrelated dirty `.agents/agent_assets_metadata.toml`, mockup-sandbox generated component, older untracked design checkpoints and `attached_assets/*` left untouched/uncommitted. Private backups/signing/owner/SDK/AVD files remain ignored. Never stage/revert those.

## Published Artifacts

- [Release v1.1.7](https://github.com/dirg9876/gym-tracker/releases/tag/v1.1.7): PUBLIC, draft=false, targetbc3543ccb4fab9d50bdcc7658a7717b9d7d223ee.
- [Public APK](https://github.com/dirg9876/gym-tracker/releases/download/v1.1.7/gym-beam-1.1.7.apk), HTTP200. Asset **660426391**, uploaded, **152337507bytes**. Remote digest EXACT local SHA256 **98EB6C3895AED1C61B5BD5FB172B29CD1AA8D412F6168D0291BFFB952C215FF9**.
- Local final `artifacts/apk/verified/gym-beam-1.1.7.apk`; package com.dirg9876.gymtracker/version1.1.7/code13. Original signing certificate SHA256 **dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a** unchanged. arm64-v8a+x86_64. APK is a Release asset, not a Git blob.
- Final fixed-script build **1m37s/835tasks**, log `release-1.1.7-build-final.log`. Both embedded-manifest and JavaScript freshness guards PASS. Initial5F3B23.../152337363byte candidate and initial7d60...export are obsolete, NOT delivery.
- FINAL Expo export `artifacts/gym-tracker-mobile/dist/_expo/static/js/android/entry-19527420d28853f3e7a6bea8506f02fd.hbc`,5.21MB/204files, log `release-1.1.7-export-final.log`. No app-source changes after final build/export.
- EAS account dirg9508/project gym-tracker-mobile/projectId **dabd3128-415f-4a2f-8c73-3b0a52585149**. Android branch/channel **production**, explicit native runtime **1.1.0**.
- OTA group **fc857612-2758-4398-a061-b920fcb855cd**, update **01a15b0b-22bb-7647-a15e-f167bb8e6caf**, created2026-10-20T20:40:18.875Z, sourcebc3543c. [Manifest](https://u.expo.dev/update/01a15b0b-22bb-7647-a15e-f167bb8e6caf). Uploaded1bundle; no new image assets needed.
- CLI16.32.0/skip-bundler published JSON. Windows execution reported exit1 amid known npxENOENT config fallback warning, but publication was independently verified by ACTUAL check/download/APPLY/reload and running01a15b0b on BOTH native13 and older native12. Do NOT republish because of that wrapper status.
- Phone update: **Обновления > Проверить обновления > Применить обновление**. Do not uninstall/clear data. Active-workout update guard remains intact.

## Automated Verification

**299 tests PASS**: mobile250, design22, API17, Worker10. Added13mobile tests: eleven replacement/editor guards and two monthly merge/cap regressions. Full workspace TypeScript, release:check, scoped gitdiff--check PASS. Exact-source CI also checked mobile metadata/tests, gallery validation and web/API builds.

Journey PASS: **624workouts /8970sets /4617835kg /182seconds /findings[]**. This is a deterministic synthetic scenario, not a physiological prediction. Backend simulation preceded header-only UI fix; final full tests/typecheck repeated after that fix.

Coverage includes histories/records/tonnage, duplicate exact targets, atomic create/rollback, state+plan rollback, old archive import, cold-load journal failure/idempotence, invalid IDs/equipment/time/assistance/dumbbell counts, bodyweight/assistance snapshots, running/transferred timers, stale draft revisions and distinct any-three counting. Existing archive-dependent tests were updated, not disabled.

Exact private-value scan PASS: **28stagedsourcefiles /1448uncompressedFINALAPKentries /204freshOTAfiles**. Actual local provider/owner values checked only in memory, never printed/shipped. Completion docs contain public results only.

## Protected Original Progress

AVD **gymbeam_test / emulator-5554**, NEVER cleared/uninstalled/restored from an older backup:
- Fresh baseline `artifacts/apk/verified/before-release-1.1.7-native.json`,13842bytes, EXACT previous1.1.6 post-OTA state/plans. Two finished workouts/eight sets/confirmedlevel3/no active workout,31active+3unuseddeleted exercises, plans0. nextExerciseId35/nextWorkoutId11/nextSetId15 preserved.
- Deleted metadata IDs32/33/34 were prior synthetic custom QA entries with ZERO sets. No actual recorded movement was automatically merged or removed.
- Final install-r `after-release-1.1.7-final-install.json`,12677bytes, state EXACT fresh baseline after filtering ONLY those three unused tombstone rows. All workouts,8sets,profile,plans,counters,confirmedlevel3 and level timestamp EXACT.
- Actual production OTA check/download/APPLY/reload displayed1.1.7/Обновление01a15b0b. Fresh `after-release-1.1.7-production-ota.json`,12677bytes, state AND plans EXACT final native install.
- One-time final four notes appeared at safe Home, acknowledged; no repeat on cold start/same-version OTA; manual What's New1.1.7 works. Active synthetic fixture also did not get interrupted by a notes window.
- Final Home shows «Начать тренировку», no active/popup. Screenshot `release-1.1.7-final-original-home.png`. Current appPID ReactNativeJS:E/AndroidRuntime:E and ADBreverse empty. AI OFF, connection/settings unchanged. Primary headless AVD left running at Home.

## Isolated Native QA

AVD **gymbeam_visualqa / emulator-5556**, synthetic data only:
- Generated ignored fixture using new exercise-replacement-qa.mjs: legacy32withcompletedset, Alias33withactiveworkout, unused34. Import migrated unused34away, restored32ACTIVEpending, Home review action visible.
- Via REAL UI:32->existing3; then3->NEW35 «NewPress» using header save WHILE soft keyboard visible; then33->35 using filtered search with soft keyboard visible. Active workout showed NewPress,1of2sets and next15kg.
- Export `release-1.1.7-synthetic-after-replacement.json`,13272bytes: both original sets EXACT except chosen exerciseId35. Weights/reps/RIR/technique/body fields/set IDs/dates unchanged. One merged two-target plan12.5/15, next draft15, session timestamps/profile EXACT, no deletedAt or pending flags. Cancelled creation left no orphan.
- Regular1080x2400/density420 and small360x640dp/font1.3 inspected. Header save reachable, titles/controls fit; search results visible above keyboard. Screenshots final-create-keyboard, final-search-keyboard, active-after-merge, small-editor-keyboard and small-final-replacement under release-1.1.7 prefix.
- A deep link raced Android fontScale Activity recreation and reopened an old removed ID; cold start plus ordinary catalog tap showed correct35 and intact data. Automation timing issue, not lost progress. SAF helper assumed a missing GymTracker folder; exported manually to Documents. Android refusing the shared root is normal privacy policy, not an app failure.

## Actual Older-APK OTA And Offline Test

After main QA, verified isolatedAVDname and archived1.1.6 APK B770...hash, uninstalled ONLY syntheticQA, installed **native1.1.6/code12**. Primary never touched. Disabled QA network to establish old embedded UI.

Generated `release-1.1.7-legacy-ota-fixture.json`,12879bytes, through isolated testHarness/legitimate finish/re-export plus re-marked deleted32/checksum: two finished sessions/two original sets/no active, legacy32deletedwithhistory, Alias33active. Imported with OLD1.1.6; native backup visibly showed one deleted exercise. No newer APK installed after this baseline.

Enabled network, Updates check/download/APPLY published01a15b0b. UI became **1.1.7 / Обновление01a15b0b** while Android dumpsys remained **versionName1.1.6 / code12**. Screenshot `release-1.1.7-legacy-ota-running.png`.

Then QA Wi-Fi/data OFF, airplane mode1, cold-stopped/restarted: new catalog showed one explicit review, active Legacy32/no archive. Screenshot `release-1.1.7-legacy-offline-review.png`. Performed32->existing3 OFFLINE and exported through system picker, no network/provider:
- `release-1.1.7-legacy-offline-after-replacement.json`,12532bytes.
- All two sets EXACT imported fixture except chosen32->3.
- All sessions/profile/custom types/plans EXACT, no deletedAt/pending and source32gone.
- Native package STILL1.1.6/code12, airplane1 at proof time. Confirms update without APK reinstall, canonical migration, replacement and export work offline on old native runtime.

Restored QA airplane0/Wi-Fi+data enabled, physical1080x2400/density420/font1.0/hardware-keyboard-IMEsetting0; verified and stopped isolated AVD. Its current saved data is synthetic, older native12 with cached1.1.7 OTA. Current appPID error log empty.

## Limitations And Next Step

Physical phone/iOS not directly tested; native dark theme tested. Candidate compatibility protects measurement semantics, NOT biological equivalence between different exercises. User must explicitly choose pending replacements for real historical entries. Mixed generic/exact duplicates and monthly totals over six deliberately reject instead of losing prescribed targets. No archive data remains in the protected current catalog; old external backup files are intentionally preserved.

No build/export/upload/test/required exec sessions remain. Gradle daemon stopped; no Metro/dev server/ADB reverse. Source release COMPLETE; only documentation-only completion commit/push follows this checkpoint. No new app build/bump/OTA for that. Next user-requested logical release:1.1.8.

## Tooling For A New Chat

Node `C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin`; pnpm `C:\Users\Dirg9\AppData\Local\pnpm\pnpm.CMD`; gh `C:\Program Files\GitHub CLI\gh.exe`; JDK17 `C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`; SDK `C:\gymbeam\artifacts\android-sdk`; AVD_HOME `C:\gymbeam\artifacts\android-avd`. Prepend runtime paths.

Build ONLY mobile scripts/build-release.ps1 with JAVA_HOME/ANDROID_HOME; keep BOTH embedded manifest and JS freshness guards. Future compatible OTA needs its own fresh source/export, not this stale dist. Stable runtime1.1.0 does not equal displayed app version. Native incompatible changes need a new runtime/APK.

Native helper scripts/android-ui-helpers.ps1: set ANDROID_SERIAL BEFORE dot-source, verify AVD name before destructive QA setup, never concurrent taps/dumps on one AVD. Retry transient null-root dumps after navigation; wait after font/size Activity recreation. Folder picker may start at root or Documents; choose a permitted folder before USE THIS FOLDER. Always freshly export protected progress before future work; NEVER overwrite with an old backup.

Git identity per command: -c user.name=dirg9876 -c user.email=273524213+dirg9876@users.noreply.github.com. Push with gh on PATH/GIT_TERMINAL_PROMPT=0 and git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin master. No force/default-branch changes, no APK Git blobs or credentials. CHECKPOINT.md must point here until a newer task checkpoint exists.
