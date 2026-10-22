import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storage, request } from "./testHarness.mjs";
import { bumpRelease, checkRelease, validateRelease } from "./release.mjs";
const { SEEN_RELEASE_KEY, isNewerRelease, hasUnreadRelease, acknowledgeRelease, canShowReleaseNotes } = await import("../lib/releaseNotes.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");

beforeEach(() => { storage.clear(); delete globalThis.__storageFault; });

test("first launch shows release notes; only acknowledgement persists and next launch stays quiet", async () => {
  assert.equal(await hasUnreadRelease("1.1.1"), true);
  assert.equal(storage.has(SEEN_RELEASE_KEY), false);
  assert.equal(await hasUnreadRelease("1.1.1"), true);
  await acknowledgeRelease("1.1.1");
  assert.equal(await hasUnreadRelease("1.1.1"), false);
  assert.equal(await hasUnreadRelease("1.1.2"), true);
});

test("version comparison is numeric; rollbacks and manual reopening never downgrade acknowledgement", async () => {
  assert.equal(isNewerRelease("1.1.10", "1.1.9"), true);
  assert.equal(isNewerRelease("1.10.0", "1.9.99"), true);
  assert.equal(isNewerRelease("2.0.0", "1.99.99"), true);
  assert.equal(isNewerRelease("1.1.1", "1.1.2"), false);
  assert.equal(isNewerRelease("1.1.1", "broken"), true);
  assert.equal(isNewerRelease("invalid", null), false);
  await acknowledgeRelease("1.1.2");
  await acknowledgeRelease("1.1.1");
  await acknowledgeRelease("1.1.2");
  assert.equal(storage.get(SEEN_RELEASE_KEY), "1.1.2");
});

test("automatic notice waits for safe home screen and never interrupts an active workout or recovery", () => {
  assert.equal(canShowReleaseNotes("/", true, false), true);
  assert.equal(canShowReleaseNotes("/(tabs)", true, false), true);
  assert.equal(canShowReleaseNotes("/", false, false), false);
  assert.equal(canShowReleaseNotes("/", true, true), false);
  for (const path of ["/workout/1", "/backup", "/coach-plan", "/updates"]) assert.equal(canShowReleaseNotes(path, true, false), false);
});

test("storage failure can be retried; it does not falsely mark a release as read", async () => {
  globalThis.__storageFault = ({ operation, key }) => { if (operation === "setItem" && key === SEEN_RELEASE_KEY) throw new Error("Disk full"); };
  await assert.rejects(acknowledgeRelease("1.1.1"), /Disk full/);
  assert.equal(storage.has(SEEN_RELEASE_KEY), false);
  delete globalThis.__storageFault;
  assert.equal(await hasUnreadRelease("1.1.1"), true);
  await acknowledgeRelease("1.1.1");
  assert.equal(await hasUnreadRelease("1.1.1"), false);
});

test("release acknowledgement does not alter progress; importing progress does not reset it", async () => {
  await request("/api/exercises");
  const before = JSON.parse(await exportProgress());
  await acknowledgeRelease("1.1.1");
  assert.deepEqual(JSON.parse(await exportProgress()).state, before.state);
  await restoreProgress(JSON.stringify(before));
  assert.equal(await hasUnreadRelease("1.1.1"), false);
});

test("checked-in app version, notes, Android code and explicit OTA runtime are consistent", async () => {
  const { config, release } = await checkRelease();
  assert.equal(config.expo.version, release.version);
  if (release.displayVersion) assert.match(release.displayVersion, new RegExp("^" + release.version.replaceAll(".", "\\.") + "[a-z]$"));
  assert.ok(release.changes.length > 0);
});

test("patch release increments version and Android code together while retaining native runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "gym-beam-release-"));
  try {
    const config = { expo: { version: "1.1.9", runtimeVersion: "1.1.0", android: { versionCode: 15 } } };
    await writeFile(join(root, "app.json"), JSON.stringify(config));
    await writeFile(join(root, "release.json"), JSON.stringify({ version: "1.1.9", releasedAt: "2026-10-16", changes: ["Previous change"] }));
    await bumpRelease({ root, notes: ["New change"], date: "2026-10-17" });
    const result = await checkRelease(root);
    assert.equal(result.release.version, "1.1.10");
    assert.equal(result.config.expo.version, "1.1.10");
    assert.equal(result.config.expo.android.versionCode, 16);
    assert.equal(result.config.expo.runtimeVersion, "1.1.0");
    assert.deepEqual(result.release.changes, ["New change"]);
    const before = await readFile(join(root, "app.json"), "utf8");
    const previousRelease = await readFile(join(root, "release.json"), "utf8");
    for (const notes of [[], [""], ["Same", "Same"], ["x".repeat(301)]]) await assert.rejects(bumpRelease({ root, notes }));
    await assert.rejects(bumpRelease({ root, notes: ["Valid"], date: "2026-02-30" }));
    assert.equal(await readFile(join(root, "app.json"), "utf8"), before);
    assert.equal(await readFile(join(root, "release.json"), "utf8"), previousRelease);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("release validation rejects mismatched versions and appVersion policy to protect old OTA clients", () => {
  const release = { version: "1.1.1", releasedAt: "2026-10-17", changes: ["Update"] };
  assert.throws(() => validateRelease({ expo: { version: "1.1.0" } }, release), /versions differ/);
  assert.throws(() => validateRelease({ expo: { version: "1.1.1", android: { versionCode: 7 }, runtimeVersion: "1.1.0" } }, { ...release, displayVersion: "1.1.10a" }), /Invalid display release label/);
  assert.doesNotThrow(() => validateRelease({ expo: { version: "1.1.1", android: { versionCode: 7 }, runtimeVersion: "1.1.0" } }, { ...release, displayVersion: "1.1.1a" }));

  assert.throws(() => validateRelease({ expo: { version: "1.1.1", android: { versionCode: 7 }, runtimeVersion: { policy: "appVersion" } } }, release), /explicit native runtime/);
});

test("local release build invalidates and verifies both embedded JS and Expo manifest", async () => {
  const script = await readFile(new URL("./build-release.ps1", import.meta.url), "utf8");
  assert.match(script, /createBundleReleaseJsAndAssets\/index\.android\.bundle/);
  assert.match(script, /createReleaseUpdatesResources\/app\.manifest/);
  assert.match(script, /foreach \(\$output in @\(\$embeddedManifest, \$embeddedBundle\)\)/);
  assert.match(script, /Remove-Item -LiteralPath \$output -Force/);
  assert.match(script, /manifest\.commitTime -lt \$buildStartedMs/);
  assert.match(script, /bundle\.LastWriteTimeUtc\)\.ToUnixTimeMilliseconds\(\) -lt \$buildStartedMs/);
  assert.ok(script.indexOf("Remove-Item") < script.indexOf("$buildStartedMs ="));
});
