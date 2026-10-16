# Gym-Beam 1.1.1: Versioning And Release Notes

## Goal And State

User date 2026-10-17, Europe/Moscow. Workspace `C:\gymbeam`, Windows PowerShell.
Latest request: release the current changes as 1.1.1, increase the app version for each subsequent completed change, and show an update description after updating.
Previous request (categories, bodyweight volume, levels from any three exercises) is implemented in master commit `26337f5765b9420ed8e6a50c15296cbeefe0cf21`, pushed, OTA published and checked on the emulator. See `CHECKPOINT_2026-10-16_ANY_THREE_VOLUME.md` for that implementation.
Current 1.1.1 release is COMPLETE: source saved in master, compatible OTA published/applied, signed APK published, native checks and progress comparison passed.

## Decisions And Files

- `artifacts/gym-tracker-mobile/app.json`: display/native app version 1.1.1, Android versionCode 7. Explicit native `runtimeVersion: "1.1.0"` replaces the appVersion policy. No native API changes: installed 1.1.0/code6 must continue receiving compatible OTA. A future incompatible native change requires a new runtime and APK.
- `release.json`: authoritative user-visible release version, date and concise Russian change list. UI must not display the native runtime as the app version.
- `lib/releaseNotes.ts`: numeric version comparison, separate AsyncStorage key `gym-beam:release-notes:seen-version`, acknowledgement only after explicit dismissal. Rollback does not downgrade acknowledgement. This key is not workout progress or credentials and importing progress does not reset it.
- `components/ReleaseNotes.tsx`: shared provider/modal mounted in `app/_layout.tsx`. Automatically shown on Home when active workout query succeeds and no workout is active. Deferred during a workout, recovery, or other screens. Scrollable notes, close icon, Android Back and "Понятно". Storage errors permit closing without claiming persistence.
- `app/updates.tsx`: version from release.json and manual "Что нового" button.
- `scripts/release.mjs`: `pnpm release:check`; `pnpm release:patch --notes-file <JSON array> [--date YYYY-MM-DD]` increments patch and Android code together, validates notes/dates/alignment and preserves runtime. Does not publish automatically. Invalid input does not change files.
- `scripts/release-notes.test.mjs`: acknowledgement, restart, new release, rollback, storage failure, progress import isolation, metadata and patch command checks.
- `scripts/build-release.ps1` now validates release metadata before building. Native Gradle stderr warnings are handled without aborting PowerShell; nonzero exit codes still fail the build. CI runs on master/main and checks metadata and mobile tests.
- Root `AGENTS.md` records the user's permanent versioning/checkpoint preferences. Increment once per finished logical release, not once per individual file edit or debugging iteration.

## Verification So Far

- Mobile 197/197 PASS (189 previous + 8 release checks).
- Full workspace typecheck PASS.
- API17 and Worker10 PASS: total224 tests.
- APK1.1.1/code7 build PASS, stable certificate verified. File `artifacts/apk/verified/gym-beam-1.1.1.apk`, SHA256 `A4CB5D63C68395542AE7C0B709C561591C87DDB9634839576C845A498CC0BE0F`, arm64-v8a/x86_64. Initial PowerShell run aborted on an SDK XML stderr warning; corrected handling and retry finished successfully (835 tasks,31 executed).
- Logs: `artifacts/apk/verified/release-1.1.1-tests.log`, `release-1.1.1-typecheck.log`.
- No real AI calls or spending; production coach and its ledger are unchanged.
- Enabling CI on master found a pre-existing Git ignore issue: mobile `android/` also hid `assets/android` security/backup XML. Anchored ignores to `/android/` and `/ios/`, added the three nonsecret XML source assets; local APK already used these same files. A clean checkout must contain them for prebuild and tests.
- Exact-credential scan PASS: all1357 uncompressed APK entries and122 fresh OTA export files checked against the private provider key and owner token without printing values. Neither is embedded. Staged source scan also passed.
- GitHub CI PASS on app/source commit `f143111`: `https://github.com/dirg9876/gym-tracker/actions/runs/38968158093` (release check,197mobiletests,typecheck,web/API builds). Earlier two CI failures exposed the ignored XML files above; those were fixed, not bypassed.
- Native oldAPK6/1.1.0 successfully downloaded/applied the new runtime1.1.0 OTA. Home displayed1.1.1 and the release window. Force-stop BEFORE dismissing showed unread notes again; after "Понятно", force-stop/relaunch did not repeat. Manual reopen, X and Android Back passed. 360x640dp screenshot and scroll checks passed; full1080x2400/density420 restored.
- Matching-signed APK7/1.1.1 installed with `adb install -r` successfully; preserved acknowledgement and starts on Home. Updates displays1.1.1, not runtime1.1.0. All workout/profile/plan progress fields match the baseline exactly after both OTA and APK updates (only exportedAt/checksum ignored).
- Evidence `artifacts/apk/verified/release-1.1.1-home-ota-popup.png`, `release-1.1.1-ota-restart-no-popup.png`, `release-1.1.1-small-popup.png`, `release-1.1.1-small-popup-scrolled.png`, `release-1.1.1-apk-updates.png`, `release-1.1.1-final-home.png`; corresponding UI XML files. Backups `after-release-1.1.1-ota.json` and `after-release-1.1.1-apk.json` both match `after-any-three-native-qa.json` completely, excluding export timestamp/checksum.
- Production coach connection preserved, AI OFF; no paid calls, no local gateway or ADB reverse. ReactNativeJS/AndroidRuntime warning/error log empty. Gradle daemon stopped; build/export/publish/QA exec sessions closed. Emulator remains running on Home.

## Publication And Environment

- Git branch master, origin `https://github.com/dirg9876/gym-tracker.git`; main is the older default, do not force-push/change it. Use `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin master` if default credential helper hangs. Commit identity dirg9876 / 273524213+dirg9876@users.noreply.github.com.
- EAS account dirg9508, project gym-tracker-mobile / `dabd3128-415f-4a2f-8c73-3b0a52585149`, channel/branch production, runtime 1.1.0. Export with `pnpm exec expo export --platform android --output-dir dist`; then `pnpm dlx eas-cli@16.32.0 update --channel production --platform android --environment production --skip-bundler --input-dir dist --message "Gym-Beam 1.1.1" --non-interactive`. On Windows direct EAS bundling may fail with npx ENOENT; use the two commands above.
- Previous applied OTA group `95479512-4428-484d-a87c-48eb525e2e18`, Android ID `01a1467f-4c18-72ca-91ec-92c4523905e1`, source26337f5.
- Current published/applied OTA group `6a63401d-48e2-473c-9c2a-12d833a3a4f7`, Android ID `01a14691-93e2-767e-9c6e-e26308814e97`, native runtime1.1.0, source `0fd33426787334df592aaeda67497d616d3036bf` (EAS marked dirty because unrelated worktree changes existed; no secrets or unrelated files are bundled). Dashboard `https://expo.dev/accounts/dirg9508/projects/gym-tracker-mobile/updates/6a63401d-48e2-473c-9c2a-12d833a3a4f7`.
- App implementation commit `4ae7379fc2b7928356ab2be2aeebbc7faf262c69`; build-warning handling0fd3342; clean-build XML/source fixf143111. All pushed to master. Final checkpoint/release documentation is a later docs-only commit in the same release, not an additional app change.
- Node/pnpm PATH `C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin`. JDK17 `C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`; SDK `C:\gymbeam\artifacts\android-sdk`.
- Emulator gymbeam_test / emulator-5554, Android36 x86_64,1080x2400,density420. ADB `artifacts/android-sdk/platform-tools/adb.exe`. UI helpers `artifacts/gym-tracker-mobile/scripts/android-ui-helpers.ps1`. Pause ticking timers for uiautomator; search footer buttons with bottom2350; wait for async navigation.
- Build with mobile `scripts/build-release.ps1`; requires existing private `artifacts/apk/debug.keystore`. Certificate SHA256 `dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a`, key file SHA256 `5013232F77A47ECBF2980735F28B1CA0619A5D3F036657F4495F9CD84AD96AF2`. Never regenerate/re-sign with a different key or uninstall to get around mismatch. Gradle memory3GB/metaspace1GB/maxworkers2, architectures arm64-v8a,x86_64. APK assets go to GitHub Releases, never Git blobs.
- Previous APK1.1.0/code6 at `https://github.com/dirg9876/gym-tracker/releases/download/v1.1.0/gym-beam-1.1.0.apk`.
- Current GitHub Release `v1.1.1`, target master atf143111: `https://github.com/dirg9876/gym-tracker/releases/tag/v1.1.1`. APK `https://github.com/dirg9876/gym-tracker/releases/download/v1.1.1/gym-beam-1.1.1.apk`, 95,709,661bytes. GitHub asset digest matches local SHA256 above. User-facing notes `docs/releases/v1.1.1.md`. APK is not a Git blob.
- Private `.env.coach`, `.coach-data`, `.cloud-deploy`, `.wrangler`, owner-token, connection file, signing keys, personal backups, SDK/AVD must never enter source/APK/OTA/logs. Scan exact private values in memory without printing. Local paid gateway remains blocked; Cloudflare Workers Free / production `https://gym-beam-coach.dirg9876.workers.dev` unchanged, no ledger reset or AI smoke calls.

## User Data And Remaining Work

Current emulator baseline `artifacts/apk/verified/after-any-three-native-qa.json`: two finished workouts, eight real sets, 31 available exercises, no active workout, bodyWeightKg=null. New any-three rule legitimately raised level0 to3. Temporary empty workout8 was deleted, temporary exercise32 soft-deleted without sets. Counters nextWorkoutId9/nextExerciseId33/nextSetId11. Do not restore an older backup over this state.
Earlier `before-any-three-ota.json` has the same real workouts/sets/exercises1..31 but level0 and counters8/32/11. Compare originals deeply; allow only documented QA counters, deleted unused exercise32, level3 and level-up timestamp.
Native category/level tests passed; known-mass bodyweight arithmetic was checked in isolated integration tests, not by guessing the user's weight. `.agents/agent_assets_metadata.toml`, mockup generated metadata and untracked attached_assets are unrelated user changes: leave alone.

## Limitations And Next Step

The current task is done. On the user's phone with OTA-capable1.1.0, use Updates > Check > Apply after finishing any active workout; no uninstall is needed. Physical phone/iOS testing was not performed. New APK uses the same local signing key as1.1.0/code6; the original earlier EAS APK may have a different signature. Never solve a signature mismatch by uninstalling without a verified external backup.

Automatic notice deferral during a workout/recovery was tested at the unit policy boundary; native tests used a baseline with no active workout, without inventing user sets or resetting acknowledgement storage. Notes also show on first installation, since no previous read-version exists. A rollback to an older release must not reset the last-read newer version.

Historical bodyweight sets without mass snapshots remain approximate until a real profile mass is supplied; do not invent it. The any-three algorithm still belongs to mobile offline storage, not the separate legacy web/server implementation. Other previously documented domain limitations remain in the categories checkpoint.

For the NEXT completed app change, release1.1.2: prepare a JSON array of actual Russian notes, run mobile `pnpm release:patch --notes-file <file>` (updates app.json,Androidcode and release.json), test and `pnpm release:check`. Keep native runtime1.1.0 only for compatible changes. Publish a fresh export, verify the one-time window and backup comparison, update checkpoint, then publish compatible OTA and optional signed APK. Do not bump again for QA iterations or docs-only corrections within that release. Preserve all unrelated user worktree files and private production credentials.
