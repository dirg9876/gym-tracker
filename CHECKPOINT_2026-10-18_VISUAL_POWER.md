# Gym-Beam: First Rocky Selected, Visual Power V4

## Current Goal

2026-10-18, Europe/Moscow. Workspace C:\gymbeam, PowerShell, full filesystem/network access, approval policy never. Android app is artifacts/gym-tracker-mobile. Read root AGENTS.md first. This is a DESIGN/DRAFT stage, not an app update or publication.

User wants adult humorous pixel-art level characters inspired by Punch Club, mainly movie/game references rather than Russian fairy tales. Galleries must be separate by profile sex; update MALE only, leave FEMALE text and original pictures exact. User clarified appearance like Punch Club WITHOUT mandatory32x32 dimensions.

LATEST USER DECISION: "первый вариант лучше" means FIRST Rocky from the two new v4 attempts, NOT the much coarser second. Also visual physical power must roughly grow with level: level1 cannot look bigger/more powerful than level30. Respect this both when generating and integrating. Do not substitute the assistant's preferred coarser variant.

## Accepted Style And New Work

Selected STYLE ONLY: docs/design/levels/pixel-study-v4/rocky-style-selected.png, copied byte-identically from C:\Users\Dirg9\.codex\generated_images\01a0111b-d08e-7400-873c-37ce9649d0ad\exec-7c01921b-a262-41f2-b1ea-e319a49281e7.png. SHA256 d0e33abfd176b7bbe4a4c74578517620e3433a9eacb6e5f031b3dbf78ebdaee6. Actual1024x1536 PNG, visible moderate pixel steps, adult anatomy, red gloves/gray hoodie. NOT a verified fixed low-resolution grid or indexed palette; no claim of literal32pixels. Original remains in place.

rocky.prompts.json now records userSelection=firstAttempt. Historical assistant opinion that first was too detailed is overridden by user preference. The `output` object still records the SECOND file for provenance and is marked not-selected; do not mistake it for current selection. Second file rocky-candidate.png / exec-5e8c07d3-c155-404e-af88-aa83c415a46f.png remains historical, not deleted.

render-preview.ps1 now defaults to the SELECTED first image and writes rocky-selected-preview.png. Explicit InputName/OutputName can reproduce older diagnostics. First Rocky inspected at250/100/48px contain on light and graphite backgrounds. No source pixels changed by diagnostic compositor. Original rocky-preview.png is the old second-image diagnostic, not selected.

## New Files And Design Contract

- docs/design/levels/visual-power-v4.json: source-to-new-order mapping for all81 male source IDs, nine visual-power bands, body/stance instructions, same-scale frame rules, selected reference and SHA pin, specific anti-inversion pairs. Editing these inputs and running the builder regenerates the current draft.
- art-direction-male-v4.md: authoritative new brief, adult/pixel/humor policy, visual strength growth, QA requirements, no female/data changes. v3 brief has an archival warning linking here; old generation remains disabled.
- build-power-catalog.mjs: standard Node structured generator/validator, imports validateCatalog from existing v3 tooling. `--write` mechanically generates catalog-male-v4.json and .md; without it checks files are current and selected PNG hash matches. No app imports these files.
- build-power-catalog.test.mjs: nine new design-contract tests; existing validate-catalog.test.mjs has nine tests. IDs complete, source not mutated, bands/pose instructions assigned, first-reference hash, ordering regression pairs, fixed frame and female/norm contracts tested. These validate DATA, not visual anatomy.
- catalog-male-v4.json / catalog-male-v4.md: current generated male draft. IDs still0..80. `sourceCatalogId` is design provenance ONLY, not app/history migration. v3 JSON remains source/archival catalog; do not edit generated v4 by hand.

Nine art bands:0-8ordinary beginners,9-17first habits,18-26sporty,27-35action athletes,36-44fighters,45-53large strength athletes,54-62heroic,63-71superhuman/cybernetic,72-80legends. Muscular development, chest/shoulder/limb bulk and a planted stance increase across large gaps. Small adjacent differences and lean but powerful heroes are allowed. This is a gym-parody art sequence, not canonical cross-universe battle ranking or a scientific claim that body size equals real strength.

Reordered cinematic outliers: Doc Brown now11 instead of60, Hannibal14 instead of61, Mulder15 instead of35, Venkman17 instead of75, Star-Lord20 instead of78. Rocky source15 now29; Van Damme remains30; Arnie source79 now49; Terminator source47 now69; Atlas remains80. Explicit new-ID mapping is essential: old artwork cannot be assigned by its filename blindly.

One character replacement: old source53 Yoda/Magistr is now Koloss/Colossus at new72, name "Колосс после смены", caption "Металл свой. Диски всё равно казённые." Tiny Yoda undermined a high physical-power silhouette; adult cinematic Colossus fits. Source ID remains for provenance only. Saitama remains79 as a recognizable lean-strong exception: must still look adult/athletic/forceful, not fragile novice-sized. Atlas80 gets the strongest final silhouette and a globe beside the shoulder so the prop does not shrink his body.

Frame TARGETS, not automatic image-generator guarantees: square canvas, body height76-82%, baseline91%, outside margins>=6%, similar head scale/pixel density and three-quarter camera. Do not convey strength by zooming the next character, enlarging their bag, hiding a small body behind armor or adding an aura. Do not auto-fit each whole alpha bounding box so props change body scale. Need visual review of1/30/80, all band boundaries and actual neighbours at48/100px before integration.

## New Comparison Image

Created ONE additional built-in image_gen composition study (not three individual production portraits): docs/design/levels/pixel-study-v4/power-comparison.png. Exact prompt/mode/source/measurements saved in power-study.prompts.json. Input was selected first Rocky for style only; source model images not copied from Punch Club. No coach key or paid CLI/API used.

Source C:\Users\Dirg9\.codex\generated_images\01a0111b-d08e-7400-873c-37ce9649d0ad\exec-56b589e4-40ed-4b94-9207-eee31bd5aca5.png. Workspace copy1536x1024,1717179bytes, SHA256 b284febd67d66841d51179c916c2ddcda1217c6f33a07ed0743fef47504b6b2d. Visually viewed and shown: LEFT=1 ordinary adult red shirt/calendar, MIDDLE=30 Van Damme black athletic top/red belt, RIGHT=80 bearded Atlas/globe. Chest, arms and legs grow visibly at similar body heights/baseline. User has NOT yet reviewed this comparison in a reply.

Read-only pngjs QA: alpha0=49.8387%, alpha>=250 core=39.9597%, other partial alpha=10.2016%, core bounds[61,49,1507,975]. Actual transparency exists, but this is NOT production accepted. Limitations: finer pixel detail drifted from chosen first Rocky; align production to selected reference, not this new sheet. Right core margin28px under6% target. Soft alpha remains. Individual square portrait framing and48/100px checks of these three production images are NOT done because no separate production images exist. Do NOT slice this concept sheet into production assets or claim all81 are ready.

## Verification This Turn

- `node --test docs/design/levels/validate-catalog.test.mjs docs/design/levels/build-power-catalog.test.mjs`:18/18PASS after final tooling edits.
- `node docs/design/levels/build-power-catalog.mjs --write`:81entries/9bands written; then command without --write: generated files CURRENT and selected first-image SHA check PASS.
- `node docs/design/levels/preserve-female.mjs`:81female text pairs and90original PNG hashes PASS. Run without --capture, NEVER replace baseline.
- Selected first-reference preview visually checked at250/100/48 on light and dark; comparison sheet reviewed at full size. Visual grid/palette and anatomy are not guaranteed by numeric tests.
- `git diff --stat -- artifacts/gym-tracker-mobile lib/level-data`:EMPTY. No app source/assets, norms, workout data, backups, profile or release metadata changed.
- No new app regression/native/emulator/phone tests, APK, OTA, CI, Git commit/push or GitHub release in this design stage. No active exec/imagegen session remains needed/running.

## Previous Art And Known App Work

Old stopped v3 party has20 selected draft PNGs in IGNORED artifacts/apk/verified/level-art-male-v3:0..17 inclusive plus47/80. They are too detailed/unapproved and use OLD IDs. male-generation-v3.json remains generationEnabled=false, approvedForProduction=false. Do NOT restart61remaining or accept an orphan18 generated on provider after earlier cancellation. Exact old prompts/source hashes in male-generation-v3.sources.json. All originals preserved. Earlier checkpoint CHECKPOINT_2026-10-18_PIXEL_STYLE_REVIEW.md is archival.

Known future mobile integration issue: lib/levelImages.ts currently has male-only maps, and app/(tabs)/levels.tsx omits data.sex for image calls, while text switches sex. Web tierImages.ts supports both. Future integration must wire existing unchanged female source images from artifacts/gym-tracker/src/assets/levels/*-f.png, not redraw women. Baseline file female-baseline-v1.json captures81text pairs+90images. No app fix attempted in this art-only turn.

A full male rollout must bind all81new accepted images and matching names/captions together. Do not relabel old mismatched artwork or change WRPF sex-specific norms, any-three-exercises qualification, confirmed level values or history. Shared lib/level-data affects web too; plan male web consistency before changing it.

## App Release And Safety

Current published app1.1.3, Android code9, explicit native runtime1.1.0; master HEADf50109c, published app source986d59e. APK https://github.com/dirg9876/gym-tracker/releases/download/v1.1.3/gym-beam-1.1.3.apk . No release bump for this docs/art prototype. Next completed app release1.1.4: app.json/release.json together via pnpm release:patch --notes-file <JSON-array>, concise Russian notes, release:check; runtime stays1.1.0 only for compatible JS/assets. Native compatibility changes require new runtime/APK. Local APK via scripts/build-release.ps1, preserve original signing key and embedded manifest verification. Publish master normally, APK as GitHub Release asset, no force push.

Preserve real offline progress and backup/import/optional coach architecture, active workout and What's New behavior. Do not overwrite progress or enable AI as art QA. Former test emulator gymbeam_test/emulator-5554 has protected real data; do not restore old backups onto it. Full previous production QA/signing/update details: CHECKPOINT_2026-10-17_RELEASE_1_1_3.md.

All design docs/art/checkpoints UNCOMMITTED. Inspect git status before staging. Unrelated dirty .agents/agent_assets_metadata.toml, artifacts/mockup-sandbox/src/.generated/mockup-components.ts and attached_assets/* must remain untouched. No keys/tokens/private connection JSON/progress backups/SDK/AVD files in Git. Do not read provider credentials for art. Built-in generation only, no claim of unlimited/free account usage.

Node executable: C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe. Existing pngjs via artifacts/gym-tracker/node_modules/pngjs; no dependency install needed. Use apply_patch for manual edits. No subagents/goals/automations were created.

## Next Step

Use FIRST Rocky as rendering reference and v4 as the current power/order contract. Show/read user feedback on comparison. Refine a few individually generated anchors (1,30,80 plus intermediate boundaries) with consistent pixel density, same frame and increasing body power. Inspect actual PNGs and48/100px neighbours; fix failures before mass work. Then produce all81male images, preserve females, integrate coherent catalog/art/sex selection, test natively, prepare1.1.4 and publish only after actual completion. The comparison alone does not authorize calling this release done.
