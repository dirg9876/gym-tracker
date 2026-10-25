# Gym-Beam Working Rules

- The Android app is in `artifacts/gym-tracker-mobile`. Work with the existing offline data, backup and optional AI coach architecture.
- Gym-Beam is the public application name and Android is the only app platform. Keep the offline-first architecture, canonical mobile assets, optional AI gateways and shared offline API contracts. Do not add other app platforms or a mandatory workout backend.
- The user requires a new app version for every completed logical app release. The current release is 1.1.24. Increase the patch version for the next completed change, not for each file edit or test iteration within a release.
- Update `app.json` and `release.json` together. Add concise Russian release notes for the actual changes. Use `pnpm release:patch --notes-file <json-file>` from the mobile directory; the file must contain a JSON array of notes. Run `pnpm release:check` before publishing.
- Keep `expo.runtimeVersion` stable for native-compatible OTA changes. It is an explicit native compatibility identifier, not the displayed app version. Native API/dependency/config changes that affect compatibility require a new runtime and APK. Never send incompatible JavaScript to older APKs.
- Use `scripts/build-release.ps1` for local release APKs. It refreshes and verifies both the embedded Expo manifest and JavaScript bundle; Gradle may otherwise miss shared workspace TS, JSON or PNG changes and ship old code or images. Keep Android keyboard resizing native (`adjustResize`), with iOS-only KeyboardAvoidingView behavior in forms, and preserve gesture roots in modal scrollable views.
- Keep the one-time release-notes window and the manual "What's new" entry in Updates working. Do not interrupt an active workout or overwrite progress to test the window.
- Preserve the existing signing key, all user history and unrelated worktree changes. Never publish private keys, owner tokens, connection files, personal backups, SDK/AVD files or credentials.
- The publication and default branch is `master`. APKs belong in GitHub Release assets, not Git blobs. Do not force-push or change the default branch.
- Write a self-contained checkpoint after meaningful work: goal, decisions, parameters, files, verification results, unresolved limitations and next step. Keep `CHECKPOINT.md` pointing to the latest checkpoint.
