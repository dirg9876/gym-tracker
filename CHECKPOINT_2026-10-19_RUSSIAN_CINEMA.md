# Gym-Beam 1.1.6: Russian Cinema And Graduated Humour

## Status

COMPLETE. Released 2026-10-19, completion checkpoint finalized 2026-10-20 (Europe/Moscow). Workspace `C:\gymbeam`, PowerShell. Source **1c9d0612083c6176a198b11273bb8d55c4e8b4f1** is on `master`. Exact-source [CI39311520678](https://github.com/dirg9876/gym-tracker/actions/runs/39311520678) SUCCESS. GitHub Release and production Android OTA published, applied and verified. Do NOT repeat publication or regenerate accepted art.

Version **1.1.6 / Android code12 / native runtime1.1.0**. No native API/dependency changes. Next logical app release **1.1.7**. Documentation-only completion does not require another version/build/publication.

## Goal And Decisions

Replace ten less familiar male heroes with Russian cinema characters of the 1990s/2000s, improve humour, allow mocking early levels with respect growing with level. Preserve female gallery, relative visual power, offline history/backups/optional AI.

Ten replacements at UNCHANGED numeric IDs/power bands:
- 13 Виктор Багров, Брат1997 / Брат2(2000).
- 14 Генерал Иволгин, Особенности национальной рыбалки1998.
- 17 Кузьмич, Особенности национальной охоты1995.
- 18 Данила Багров, Брат1997/2000.
- 21 Антон Городецкий, Ночной дозор2004 / Дневной дозор2006.
- 24 Кот из «Бумера», Бумер2003.
- 32 Саймон из «Жмурок», Жмурки2005, Дмитрий Дюжев.
- 34 Артём Колчин, Бой с тенью2005.
- 51 Гудвин, Параграф78(2007).
- 60 Волкодав, Волкодав2006, Александр Бухаров.

Five early names1/2/3/5/6: «Спонсор фитнес-клуба», «Турист в раздевалке», «Шейкерный чемпион», «Ревизор блинов», «Герой понедельника». Their existing images retained/reapproved. Total15names/78captions changed. Tone0-8sharp habit roasts,9-17teasing,18-35camaraderie,36-53earned respect,54-80legendary respect/dry film irony. High heroes no longer mocked as helpless beginners. No unsafe exercise/medical advice. Examples3«Шейкер качает чаще, чем бицепс.»;7«Отдых между подходами длиннее трудового стажа.»;48«Цепи сняты. Авторитет от этого легче не стал.»;80«Мир на плечах. Дальше только прибавлять планеты.»

Ten new transparent square PNGs individually generated using built-in image_gen, NOT paid CLI/API. First Rocky remains pixel density/adult proportions reference; common male inset6%. Existing main160/192dp, row96dp and expanded216dp sizes retained. Lean civilians below fighters/heroic athletes. Female81labels/90originalPNG hashes EXACT unchanged, other71male portraits unchanged. Only22PNG changed: ten portraits plus chapter1representative on EACH platform. Numeric levels, sports norms, any-three progression, profile/history/plans/AI unchanged. sourceCatalogId is editorial provenance, not a data migration.

## Artwork Files And Reproduction

Pipeline remains v4, v3 archival. `docs/design/levels/build-power-catalog.mjs --write` generates catalog JSON/MD; `male-art-v4.mjs` requests/records/renames/approves/audits; `sync-level-gallery.mjs --install` copies accepted raw assets/representatives and replaces ONLY male TS table via syntax nodes.

Exact accepted prompts/output paths/SHA256/approvals/rejected probes: **docs/design/levels/male-generation-v4.sources.json**. Spec male-generation-v4.json has allowedIds10, optional identityReferences{path,url,role}, generationEnabled=false, approved-for-1.1.6. Do not regenerate accepted assets. Image1selectedRockySTYLE; Image2movie/actorIDENTITY only. Style pixel-study-v4/rocky-style-selected.png SHA256 d0e33abfd176b7bbe4a4c74578517620e3433a9eacb6e5f031b3dbf78ebdaee6.

Assets saved in BOTH mobile/web level folders, not only generated_images. Ignored raw/review sheets `artifacts/apk/verified/level-art-male-v4`; ignored public stills cinema-references/*, URLs/roles in spec. General age/clean-shaven face, Kuzmich ginger beard/ushanka, Gorodetsky likeness corrected from references. Wolfhound has dark-blond hair, not Aragorn-dark. Kuzmich1.44%top margin failed unchanged2%gate; image_gen framing edit fixed it. Ten reviewed at210/100/48px light/dark with neighbours; official81technical/manual audit PASS.

## Two Bugs Found And Fixed

1. Gradle reused old JS after only shared TS/JSON/PNG changes: first code12 candidate embedded1.1.5 UI. `scripts/build-release.ps1` now removes ONLY known generated Expo manifest AND createBundleReleaseJsAndAssets/index.android.bundle, verifies manifest commitTime and nonempty bundle LastWriteTimeUtc after build start. Final build reran JS, both guards PASS, regression test added.
2. Android expo-image/Glide disk cache displayed old portraits under reused drawable URIs despite new JS/PNG. Clearing ONLY empty isolated5556 proved cause; protected5554 NEVER cleared. `components/LevelPortrait.tsx` uses existing supported `cachePolicy="memory"`; raw Expo Updates assets/offline persist, no global/user-data clearing, no new native runtime. Regression guard added. Final install-r over ORIGINAL retained cache/data showed new Danila/Kuzmich. Legacy1.1.5native +newOTA also showed newDanila offline.

Rejected candidates:98596576.../152520435bytes(oldJS), C596FD0E.../152323395bytes(stale image cache). Neither is delivery. Same release/code maintained during iterations.

## Published Artifacts

- [Release v1.1.6](https://github.com/dirg9876/gym-tracker/releases/tag/v1.1.6), PUBLIC/draftfalse/targetsource1c9d0612083c6176a198b11273bb8d55c4e8b4f1.
- [Public APK](https://github.com/dirg9876/gym-tracker/releases/download/v1.1.6/gym-beam-1.1.6.apk), HTTP200. Asset657227327,152323387bytes. Remote digest EXACT local SHA256 **B7703D0BA03B5E61C4DD6B6138B55BDB4B70613855FFCB9281C868C247AE7348**.
- Local FINAL `artifacts/apk/verified/gym-beam-1.1.6.apk`. Original signing certificate SHA256 dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a. Package com.dirg9876.gymtracker/version1.1.6/code12/arm64-v8a+x86_64. APK in Release assets, not Git blobs.
- Fixedscript final build log release-1.1.6-build-final.log SUCCESS1m30s/835tasks. FINAL export `artifacts/gym-tracker-mobile/dist/_expo/static/js/android/entry-41fd9429679af1c4c601a84db7b55f47.hbc`, about5.19MB/204files; release-1.1.6-export-cache-fix.log. Older62a0/0893 bundles obsolete.
- EAS dirg9508/gym-tracker-mobile /projectId dabd3128-415f-4a2f-8c73-3b0a52585149, Android production branch/channel/runtime **1.1.0**.
- OTA group **e3a4389e-7d76-4ca7-9827-3668e380372e**, Android update **01a155a8-a8cc-7f5f-a5bb-981ae8fdc8e3**, created2026-10-19T19:34:39.052Z/source1c9d061. [Manifest](https://u.expo.dev/update/01a155a8-a8cc-7f5f-a5bb-981ae8fdc8e3). Uploaded1bundle/10newassets, reused193. CLI16.32.0 finished; known Windows npxENOENT config warning fell back to bundled@expo/config, actual update verified.
- Phone update without reinstall: **Обновления > Проверить обновления > Применить обновление**. Do not uninstall/clear data.

## Verification

**286 tests PASS**: mobile237+design22+API17+Worker10. FullworkspaceTypeScript/finalnativeTypeScript/PowerShellsyntax/release:check/gitdiff--check PASS. Five new tests: three design guards (ten film slots/bands/dates; graduated concise unique81copy; approved art/provenance/frozen scope), build freshness, portrait memory cache. Full female baseline81labels/90hashes and81maleimages/labels on both platforms,9representatives,sex/fallback maps PASS;81technical/manual approvals PASS, PNG scope22files.

Exact private-value scan PASS:43 scopedfiles/1448uncompressedFINALAPKentries/204freshOTAfiles, actual local provider/owner values checked in memory, never printed/shipped. No keys/connections/backups/SDK/AVD/APK Git blobs committed. No paid AI calls/consent/model/budget/Worker/gateway changes; coach OFF, saved connection unchanged.

## Original Progress And Native QA

Protected **gymbeam_test /5554**:
- Fresh ignored baseline `artifacts/apk/verified/before-release-1.1.6-native.json`,13842bytes:2finishedworkouts/8sets/confirmed3/noactive, nextWorkoutId11/nextSetId15,31active+3deletedexercises/plans0, maleprofile/bodyweight-null fallback75 unchanged.
- State AND plans EXACT baseline via Nodeassert.deepEqual in after-release-1.1.6-install.json, **after-release-1.1.6-final-install.json**, **after-release-1.1.6-published-ota.json**. Exportmetadata may differ. NEVER imported old backup, cleared/uninstalled primary, changed profile or created QAworkouts there.
- Final upgrade over old image cache showed NEW gray-sweater/player Danila and ginger-beardedKuzmich. Screenshots original-before-image-cache-fix,original-after-image-cache-fix,original-danila-final.
- Actual OTAcheck/download/APPLY/reload PASS: Updates1.1.6/Обновление01a155a8. Manual final4notes PASS; fresh postOTAexport13842bytes state/plans EXACT.
- Notes once atsafeHome, no repeat sameversionupgrade/coldstart; manualWhat'sNew works. FinalHome/noactive/no repeatedpopup `release-1.1.6-final-home.png`. CurrentappPIDReactNativeJS:E/AndroidRuntime:E empty;ADBreverseempty.

Isolated **gymbeam_visualqa /5556**, no personal data:
- Female0unchanged;male0/1roasts+79/80respect at360x640dp/font1.3 wrap/nooverlap. Regular1080x2400/density420/font1.0newDanila18andWolfhound60expanded216dp visually PASS.
- EmptyQA only cleared for cache diagnosis. Normal dimensions/font restored during first run. Later installed archived1.1.5/code11 ONLY onemptyQA, primedoldWaymond18cache and verified old embedded1.1.5captions.
- Applied01a155a8 via Updates WITHOUT anotherAPKinstall. UI **1.1.6 / Обновление01a155a8**, Android native package still **1.1.5/code11**. Screenshot release-1.1.6-legacy-ota-running.png.
- DisabledWiFi/data+enabledairplane ONLY on5556, cold-stopped/restarted offline. Newcaption0/newDanila18 still present. Visually reviewed `release-1.1.6-legacy-offline-danila-expanded.png` (newgraysweater/player, notoldglasses/greenjacket); rowPNG saved. Proves nativecompat/cachefix/offlineassetpersistence.
- On2026-10-20resume adb lists no devices. If reusing QA, restore connectivity with cmd connectivity airplane-mode disable/svc data enable/svc wifi enable and verify normal dimensions/font before further QA.
- OS SystemUIANR on two overloadedcoldboots recovered byWait, NOTappANR. Automation failures due offscreen/fastflings fixed650msdrags/clickablerowselectors, notproductbugs.

No required exec/build/upload/test sessions left; Gradledaemon stopped. On nextdayresume no emulators connected. Physicalphone/iOS untested, native darktheme tested, lightartreview sheets inspected. Humour/likeness subjective; not every remaining reference guaranteed universally familiar.

## Changed Files

Source43files: AGENTS.md,CHECKPOINT.md,thischeckpoint; mobileapp.json/release.json,LevelPortrait.tsx,build-release.ps1,release-notes.test.mjs,level-gallery.test.mjs;22PNG;sharedlib/level-data/src/index.ts;nine designfiles(art-direction-male-v4.md,build-power-catalog.mjs/test,catalog-male-v4.json/md,male-art-v4.mjs,male-generation-v4.json/sources,visual-power-v4.json);docs/releases/v1.1.6.md/notes.json. Completiondocs separately, no appsourcechange.

Unrelated .agents/agent_assets_metadata.toml,mockup-sandboxgeneratedcomponent,olduntrackeddesigncheckpoints,attached_assets/* untouched/uncommitted. Private backups/signing/owner/SDK/AVD remain ignored.

## Next Task

1.1.6 release complete, no remaining publication work. New2026-10-20request: remove archived exercises, offer replacement by existing/new, leave no archived exercises. Investigate history/deletion semantics first; preserve history and backup compatibility, do not silently merge unrelated movements/units. NEW logical release **1.1.7**, not another1.1.6 rebuild.

## Tooling

Node C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe; pnpm C:\Users\Dirg9\AppData\Local\pnpm\pnpm.CMD; gh C:\Program Files\GitHub CLI\gh.exe; JDK17 C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot; SDK C:\gymbeam\artifacts\android-sdk; AVD_HOME C:\gymbeam\artifacts\android-avd. Prepend runtime paths.

Nativehelpers artifacts/gym-tracker-mobile/scripts/android-ui-helpers.ps1:setANDROID_SERIAL BEFORE dot-source, never concurrentUIautomationononeAVD,retrytransientRead-Uiafternavigation. Slowregularswipe5401850->5401050/650ms. Freshprotectedprogressbaselinebeforetesting; NEVER overwritewitholdbackup.

Gitidentity percommand -c user.name=dirg9876 -c user.email=273524213+dirg9876@users.noreply.github.com. PushwithghonPATH/GIT_TERMINAL_PROMPT=0: git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin master. No force. Future compatibleOTA usesfreshsourceSHA/export, notthisnowstaledist.
