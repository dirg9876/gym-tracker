import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { configureManifest, resourceName } = require("../plugins/withCoachNetworkSecurity.cjs");
test("native network policy only permits loopback HTTP and does not modify other manifest settings", () => {
  const xml = readFileSync(new URL(`../assets/android/${resourceName}.xml`, import.meta.url), "utf8");
  assert.match(xml, /base-config cleartextTrafficPermitted="false"/);
  assert.deepEqual([...xml.matchAll(/<domain includeSubdomains="false">([^<]+)<\/domain>/g)].map(match => match[1]), ["127.0.0.1", "localhost"]);
  const manifest = { manifest: { application: [{ $: { "android:label": "@string/app_name" } }] } };
  configureManifest(manifest);
  assert.equal(manifest.manifest.application[0].$["android:label"], "@string/app_name");
  assert.equal(manifest.manifest.application[0].$["android:networkSecurityConfig"], `@xml/${resourceName}`);
  assert.equal(manifest.manifest.application[0].$["android:usesCleartextTraffic"], undefined);
});
test("native secure storage is enabled and cloud archives exclude personal credentials", () => {
  const config = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
  assert.ok(config.expo.plugins.some(plugin => Array.isArray(plugin) && plugin[0] === "expo-secure-store" && plugin[1].configureAndroidBackup === false));
  assert.ok(config.expo.android.versionCode >= 2);
  const ignore = readFileSync(new URL("../../../.easignore", import.meta.url), "utf8");
  for (const pattern of ["**/.env*", "**/.coach-data/**", "**/.cloud-deploy/**", "**/.wrangler/**"]) assert.ok(ignore.split(/\r?\n/).includes(pattern));
});
test("Android backup excludes credentials without excluding progress databases and files", () => {
  const plugin = require("../plugins/withCoachSecureStorage.cjs");
  const manifest = { manifest: { application: [{ $: { "android:allowBackup": "true" } }] } };
  plugin.configureManifest(manifest);
  assert.equal(manifest.manifest.application[0].$["android:allowBackup"], "true");
  for (const name of ["gymbeam_backup_rules", "gymbeam_data_extraction_rules"]) {
    const xml = readFileSync(new URL(`../assets/android/${name}.xml`, import.meta.url), "utf8");
    assert.match(xml, /<exclude domain="sharedpref" path="SecureStore"/);
    assert.ok(!xml.includes("<include"));
    assert.ok(!xml.includes('domain="database"') && !xml.includes('domain="file"'));
  }
});
