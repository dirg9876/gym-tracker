# Gym-Beam 1.1.6: Russian Cinema And Graduated Humour

## Status And Goal

**READY TO PUBLISH**, 2026-10-19 Europe/Moscow, workspace `C:\gymbeam`, PowerShell. Implementation, 286 tests/typecheck, native APK upgrade/image-cache regression and exact progress comparison PASS. User requested less familiar male heroes replaced by Russian cinema characters of the 1990s/2000s and better captions. Newest direction: early levels MAY be mocking/insulting, with respect growing with level. Both implemented. Previous public release1.1.5/mastercdf8880; new source not committed/published at this snapshot. Remaining work is publication, actual OTA application/data verification and completion docs.

**Bumped ONCE:1.1.6 / Android code12 / explicit runtime1.1.0**, notes date2026-10-19; release:check PASS. Do NOT bump again for build/test/doc iterations. Next completed logical release AFTER this one:1.1.7. No native APIs/dependencies/compatibility changes; older runtime1.1.0 APKs may receive compatible JS/assets OTA. Original signing key, offline history/backups/optionalAI architecture preserved.

## Decisions And Implemented Scope

- Ten male replacements at unchanged IDs/power bands:13Viktor Bagrov,14General Ivolgin,17Kuzmich,18Danila Bagrov,21Anton Gorodetsky,24Kot/Bumer,32Simon/Zhmurki,34Artyom Kolchin,51Goodwin/Paragraph78,60Wolfhound/2006film. Lean/civilian heroes remain low, fighters/heroic athletes higher. Numeric levels, sports norms, any-three progression, profile/history/plans/AI unchanged. SourceCatalogId is editorial provenance, NOT a data migration.
- Ten NEW square transparent PNGs individually created with built-in image_gen. Kept first Rocky pixel density/adult proportions/common6%male inset; current160/192dp, row96dp and expanded216dp sizes retained. No bitmap crop/zoom tricks. Adult physical power checked with neighbours and1/30/80anchors. Female81labels/90originalPNG unchanged EXACT;71othermale portraits unchanged. Changed22PNGs only:10portraits+chapter1representative on EACH platform.
- Five early names1/2/3/5/6 changed toSponsorFitnessClub/Tourist/ShakerChampion/PlateAuditor/MondayHero; existing images retained/reapproved. Total15names/78captions changed. Tone:0-8sharp habit roasts;9-17teasing;18-35camaraderie;36-53earned respect;54-80legendary respect with dry film irony. High heroes no longer mocked as helpless beginners. No unsafe/medical training advice. Examples3«Шейкер качает чаще, чем бицепс.»;7«Отдых между подходами длиннее трудового стажа.»;48«Цепи сняты. Авторитет от этого легче не стал.»;80«Мир на плечах. Дальше только прибавлять планеты.»
- Reused design truth/pipeline v4; v3 remains archival. `build-power-catalog.mjs --write` generates catalogJSON/MD. `male-art-v4.mjs` request/record/rename/approve/audit; `sync-level-gallery.mjs --install` copies reviewed raw images/representatives and replaces ONLY male TS table via syntax nodes. No new data abstraction/framework.
- Generation spec has explicit allowedIds10 and optional identityReferences{path,url,role}: Image1firstRockySTYLE, Image2movie/actorIDENTITY only. No paid API fallback/key used. All accepted prompts, source paths, SHA256, approvals and rejected/superseded variants preserved in `male-generation-v4.sources.json`. Generation now DISABLED/approved-for-1.1.6; don't regenerate accepted images.
- Corrected General's first too-young/moustached probe, Kuzmich's missing ginger beard/ushanka, Gorodetsky's generic face using actual stills. Wolfhound correctly dark-blond, not Aragorn-dark. Kuzmich1.44%top margin failed2%gate; built-in framing edit fixed it without weakening acceptance. All10viewed at210/100/48px on light/dark with neighbours; official81generated/81reviewed/no-failure audit PASS.

## Two Cache Bugs Found And Fixed

1. Gradle reused old JS when only shared workspace TS/JSON/PNG changed. First candidate nativecode12 but embeddedUI1.1.5; fresh Expo manifest alone was insufficient. Fixed existing `scripts/build-release.ps1`: remove ONLY known generated manifest AND `createBundleReleaseJsAndAssets/index.android.bundle`, then verify manifest commitTime plus nonempty bundle LastWriteTimeUtc after build start. New static regression guard. Final actual build reran JS and passed both freshness checks.
2. `expo-image` default Android Glide DISK cache returned old pictures under reused drawable URIs despite new JS/PNG resources. Native screenshots showed old Waymond/Venkman labelled Danila/Kuzmich. Generated res and manifest hashes were new, and fresh OTA files contained all10new raw PNG hashes. Clearing ONLY verified emptyQA5556 proved sameAPK renders new images with clean cache. NEVER cleared protected5554. Fixed ONLY `components/LevelPortrait.tsx` with existing supported `cachePolicy="memory"`; raw Expo Updates assets/offline storage remain persisted, no global cache or user-data clearing. New gallery regression guard. Final install-r on ORIGINAL retained old cache/data correctly replaced images, proved by before/after screenshots. No native module/runtime change.

Rejected historical candidates (do NOT publish):98596576.../152520435bytes(oldJS) andC596FD0E.../152323395bytes(freshAPK but staleportraitdiskcache). They are superseded by FINAL artifact below. Same release/code maintained throughout all iterations.

## Final Artifacts

- **FINAL APK** `artifacts/apk/verified/gym-beam-1.1.6.apk`, **152323387bytes**, SHA256 **B7703D0BA03B5E61C4DD6B6138B55BDB4B70613855FFCB9281C868C247AE7348**.
- Original certificate SHA256 **dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a** verified. aapt com.dirg9876.gymtracker/version1.1.6/code12/arm64-v8a+x86_64 PASS. Local signing key unchanged.
- Final build via fixedscript: `artifacts/apk/verified/release-1.1.6-build-final.log`, SUCCESS1m30s/835tasks. Earlier freshcodebuild3m20s and rejectedfirstbuild2m21s are diagnostics, not delivery. Final APK installed-r BOTH AVDs, no uninstall; primary never cleared.
- **FINAL Expo export** `artifacts/gym-tracker-mobile/dist/_expo/static/js/android/entry-41fd9429679af1c4c601a84db7b55f47.hbc`, about5.19MB;204exportfiles; log `release-1.1.6-export-cache-fix.log`. Includes memory cache fix and final4notes. Older62a0.../0893...bundles STALE, don't publish. No source app changes since final export/build.
- GitHub expected public asset after publication: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.6/gym-beam-1.1.6.apk. NOT CREATED/PUBLIC at snapshot; must actually publish/verify, don't claim ready download yet.

## Verification

- **286tests PASS**: mobile237 +design22 +API17 +Worker10. FullworkspaceTypeScript PASS; finalnativeTS againPASS after memory-policy fix. PowerShell syntax parse PASS. release:check andgitdiff--check PASS. Logs ignored under `artifacts/apk/verified/release-1.1.6-*tests.log` andtypecheck.log.
- New5tests total: three design guards (ten film slots/bands/dates, approved graduated copy/concise unique81captions, new reviewed art/provenance/frozen scope), one build-freshness guard, one portrait-memory-cache guard. Tests don't prove humour/likeness; manual source and native review done separately.
- Female baseline81labels/90hashesPASS. Existing fullasset tests compare81maleimages+labels onmobile/web,9representatives andsex/fallback maps. All81technical/manual approvals PASS; rawimage scope22files. No sports/progression logic change and no new workout simulation needed.
- Private exact-value scan PASS: **43 scopedstagedfiles /1448uncompressedFINALAPKentries /204freshOTAfiles**, actual local provider/owner values checked in memory, none printed/embedded. No keys, connections, personal backups, SDK/AVD or APK Git blobs staged. Completion doc edits after scan contain only public results.

## Native QA And Original Data

Protected **gymbeam_test / emulator-5554**, original profile male/weightfallback75 unchanged:

- Fresh baseline `before-release-1.1.6-native.json`,13842bytes:2finishedworkouts/8sets/confirmed3/nextWorkoutId11/nextSetId15/noactive,31active+3archivedexercises/plans0. No archived backup imported over newer data; always freshly verified.
- `after-release-1.1.6-install.json` (first freshcodecandidate) AND **after-release-1.1.6-final-install.json** (FINALB770...) state+plans EXACT baseline via Nodeassert.deepEqual; exportmetadata may differ. Private ignored files atQAoutput, not committed. No user data/profile/cache clearing, QAworkouts or claims.
- Final upgrade over existing stale-cacheinstallation PASS: beforeimagecachefix shows oldWaymond/Venkman; FINALsame-data/cache upgrade displays NEW Danila sweater/player and ginger-beardedKuzmich, with newcaptions and unchanged level3/progress. Screenshots `original-before-image-cache-fix`, `original-after-image-cache-fix`, `original-danila-final`. Final newPNG rendering visually reviewed.
- 1.1.6notes appeared once atsafeHome, acknowledged, did not repeat on same-version upgrade/coldstart. ManualWhat'sNew displays4correctnotes. Current3ShakerChampion/roastmatches. Primary currentlyBackup after finalexport, noactive; leaveHomeafterOTAcheck. AI staysOFF/savedgatewayunchanged; no providercalls/consent/model/budget/Worker changes.

Isolated **gymbeam_visualqa /5556**:

- Emptyfemale0image/textunchanged, male0/1roasts and79/80respect at360x640dp/font1.3 inspected: longnames/captionswrap, nooverlap. Regular1080x2400/density420/font1.0newDanila18andWolfhound60expanded216dp visually PASS, neighbours/captions/requirements distinct, allimagesvisible.
- Cleared app ONLY here once for diskcache diagnosis after verifying AVDname, never primary. No personaldata here; afterwardemptydefaultmale75. OS SystemUIANR once during simultaneous coldboot/build recovered byWait, not appANR. Incorrect scripted scrolls used off-screen coordinates then too-fastflings; corrected to actualwm size +slow650ms drags and clickable rowcontent-desc selectors, not appbugs.
- QA wm/density reset VERIFIED physical1080x2400/420, font1.0 verified, then AVDSTOPPED. Final appPIDReactNativeJS:E/AndroidRuntime:E log empty. GradledaemonSTOPPED. No Metro/devserver/ADBreverse. PrimaryheadlessAVDkept running. No required execsessions/imagegencells pending at this snapshot.
- Physicalphone/iOS not tested; currentdarktheme only. Humour/likeness subjective, ten replacements are editorial choices, not a claim every remaining reference is universally familiar. Scale is gym parody/visualpower, not canonical cross-universe combat ranking.

## Files

43scopedfiles staged: rootAGENTS/CHECKPOINT/thischeckpoint; mobileapp.json/release.json, LevelPortrait.tsx, scriptsbuild-release.ps1/release-notes.test.mjs/level-gallery.test.mjs;22PNG; shared`lib/level-data/src/index.ts`;9designfiles(`art-direction-male-v4.md`,build-power-catalog.mjs/.test.mjs,catalog-male-v4.json/.md,male-art-v4.mjs,male-generation-v4.json/.sources.json,visual-power-v4.json);releasev1.1.6.md/.notes.json. CurrentAGENTS says1.1.6andboth-artifactfreshnessrule.

Built-in output sources/rawstaging/review sheets in ignored`artifacts/apk/verified/level-art-male-v4`; public still references ignored`cinema-references/*`, URLs/roles in generator spec. App assets persisted in BOTHmobile/webfolders, not only defaultgenerated_images. Exact prompt set/sourcehashes in tracked sources manifest; no new generation required.

Unrelated `.agents/agent_assets_metadata.toml`, mockup-sandbox generatedcomponent, untracked older checkpoints and`attached_assets/*` left untouched/uncommitted. Never revert/stage those. Privateprogress/backups/signing/SDK/AVD/owner files remain ignored.

## Remaining Publication Steps

1. Restage latestcheckpoint, `git diff --cached --check`; sourcecommit/push establishedmaster (no force/defaultbranchchanges), recordSHA, wait exact-sourceCI SUCCESS. No1.1.6commit exists yet at snapshot.
2. DraftGitHubReleasev1.1.6 with FINALB770...APK asset ONLY, targetexactsourceSHA, notes`docs/releases/v1.1.6.md`; finishupload thenpublish/latest. Verify remoteuploadedsize152323387/digestB770.../publicHTTP200. APK notGitblob. No1.1.6draftcreatedyet.
3. PublishFINAL41fd...dist to existing EASproduction Android/runtime1.1.0 usingtestedCLI16.32.0(skipbundler commandbelow), recordactualnewgroup/updateIDs/sourceSHA. No1.1.6OTA publishedyet.
4. On5554Updates:Check/download/APPLY, verifyrunning1.1.6/newupdateID (not just uploadsuccess), manualnotes/newportrait. Exportfresh`after-release-1.1.6-published-ota.json`, assertstate+plansEXACTfreshbaseline. Never import an oldbackup; noactualworkouttestneeded.
5. FinalcoldHome/noactive/no repeatedpopup/currentPIDJSerrorcheck, noADBreverse. RewritecheckpointCOMPLETEwithactualIDs/URLs/SHA/CI andupdate rootpointer. Docs-onlycompletioncommit/push, no version bump/rebuild/republish. FinalRussianresponseconcise: ten Russianheroes, tonefromroasttorespect,286tests/dataretained,OTAsteps/APK/checkpoint. Don't claimphysicalphone/iOS tested.

## Commands And Tooling

Node`C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; pnpm`C:\Users\Dirg9\AppData\Local\pnpm\pnpm.CMD`; gh`C:\Program Files\GitHub CLI\gh.exe`; JDK17`C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`;SDK`C:\gymbeam\artifacts\android-sdk`;AVD_HOME`C:\gymbeam\artifacts\android-avd`. PrependNode/pnpmPATH,buildneedsJAVA_HOME+ANDROID_HOME. EASaccountdirg9508/projectgym-tracker-mobile /projectIddabd3128-415f-4a2f-8c73-3b0a52585149. Branch/channelproduction/runtime1.1.0.

Publish from mobile: `pnpm dlx eas-cli@16.32.0 update --branch production --platform android --message "Gym-Beam 1.1.6: Russian cinema and level humour" --skip-bundler --input-dir dist --environment production --non-interactive --json`. KnownWindowsnpxENOENTconfigwarning recoversvia bundled@expo/config; don'tupgradeCLI. Gitper-commandidentity`-c user.name=dirg9876 -c user.email=273524213+dirg9876@users.noreply.github.com`;pushprependghdirectoryPATH,GIT_TERMINAL_PROMPT=0,`git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin master`.

Nativehelpers`artifacts/gym-tracker-mobile/scripts/android-ui-helpers.ps1`:setANDROID_SERIAL BEFORE dot-source. Read-Ui canfailtransientlyafterroute;retry4x600ms; neverduplicate taps blindly. Originalregularscreen1080x2400: slow swipe5401850->5401050/650ms, clickable rows have content-desc containing charactername +`УРОВЕНЬ N,`; boundrowtop>=240/bottom<2180. Small720x1280: swipe360910->360530/650ms,top>=180/bottom<=1060. Fastflings skiptargets. Don't run concurrenttap/dump scripts sameAVD. `Export-Backup` usesexistingDocuments/GymTrackerfolder. CompareJSON`.state` and`.plans` withassert.deepEqual, not exportmetadata. Private exactscanner`artifacts/apk/verified/scan-release-1.1.4.ps1` may be reusedinmemoryreplacing1.1.4->1.1.6;neverprintsecretvalues. Previouscomplete1.1.5checkpointhasadditionalworkflowdetails.
