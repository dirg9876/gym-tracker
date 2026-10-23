import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { normalizeAndroidPackage } from "../artifacts/gym-tracker-mobile/scripts/normalize-android-package.mjs";

const root = new URL("../", import.meta.url);
const text = file => readFileSync(new URL(file, root), "utf8");
const json = file => JSON.parse(text(file));
const mobile = "artifacts/gym-tracker-mobile/";

test("Android is the only application platform; browser hosting is absent", () => {
  assert.deepEqual(json(`${mobile}app.json`).expo.platforms, ["android"]);
  const scripts = json(`${mobile}package.json`).scripts;
  assert.equal(scripts.build, "expo export --platform android");
  assert.equal(scripts.serve, undefined); assert.equal(scripts.ios, undefined);
  for (const path of ["artifacts/gym-tracker/package.json", "artifacts/mockup-sandbox/package.json", `${mobile}scripts/build.js`, `${mobile}server/serve.js`, ".replit"]) {
    assert.equal(existsSync(new URL(path, root)), false, path);
  }
});

test("the production logo is owned by Android and retains its original pixels", () => {
  const data = readFileSync(new URL(`${mobile}assets/images/gymbeam-logo.png`, root));
  assert.equal(createHash("sha256").update(data).digest("hex"), "e362b2be0a56acd52af87e94ebf7d437bfb07ad2b6ce9154da38819bf0820d9b");
  assert.match(text(`${mobile}app/(tabs)/index.tsx`), /require\("@\/assets\/images\/gymbeam-logo\.png"\)/);
});

test("Android code and live gallery tools have no imports from removed applications", () => {
  function inspect(directory) {
    for (const item of readdirSync(new URL(directory, root), { withFileTypes: true })) {
      const file = `${directory}/${item.name}`;
      if (item.isDirectory()) inspect(file);
      else if (/\.(?:ts|tsx|mjs|cjs|ps1)$/.test(item.name)) assert.doesNotMatch(text(file), /gym-tracker\/src|mockup-sandbox|@workspace\/db|@clerk\//, file);
    }
  }
  for (const path of [`${mobile}app`, `${mobile}components`, `${mobile}hooks`, `${mobile}lib`, `${mobile}scripts`, "docs/design/levels", "artifacts/api-server/src"]) inspect(path);
});

test("local gateway keeps the coach but has no former workout database or authentication stack", () => {
  assert.equal(existsSync(new URL("artifacts/api-server/src/coach/core.ts", root)), true);
  assert.equal(existsSync(new URL("lib/db/package.json", root)), false);
  const dependencies = json("artifacts/api-server/package.json").dependencies;
  assert.ok(dependencies.express && dependencies.openai && dependencies["@workspace/ai-coach"]);
  for (const name of ["@workspace/db", "@clerk/express", "drizzle-orm", "cookie-parser", "http-proxy-middleware", "pino-http"]) assert.equal(dependencies[name], undefined);
  assert.match(text("artifacts/api-server/build.mjs"), /src\/coach\/index\.ts/);
});

test("mobile direct dependencies do not install a browser application framework", () => {
  const pkg = json(`${mobile}package.json`), dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of ["react-dom", "react-native-web", "vite", "tailwindcss", "@clerk/react"]) assert.equal(dependencies[name], undefined);
});

test("CI exports Android and checks both coach gateways without deploying them", () => {
  const workflow = text(".github/workflows/ci.yml");
  assert.match(workflow, /@workspace\/gym-tracker-mobile build/);
  assert.match(workflow, /@workspace\/ai-coach-worker build/);
  assert.match(workflow, /run: pnpm test/);
  assert.doesNotMatch(workflow, /@workspace\/gym-tracker\s|mockup-sandbox|vite build|--publish/);
});

test("all workspace TypeScript references point to retained packages", () => {
  for (const file of ["tsconfig.json", `${mobile}tsconfig.json`, "artifacts/api-server/tsconfig.json"]) {
    for (const reference of json(file).references ?? []) assert.ok(existsSync(new URL(`${reference.path}/tsconfig.json`, new URL(file, root))), reference.path);
  }
});

test("Android prebuild removes only Expo-generated browser and iOS commands, preserving package metadata", () => {
  const original = { name: "test", dependencies: { expo: "54.0.33" }, scripts: { android: "expo run:android", ios: "expo run:ios", web: "expo start --web", test: "node --test" } };
  const saved = structuredClone(original), normalized = normalizeAndroidPackage(original, ["android"]);
  assert.deepEqual(normalized, { ...original, scripts: { android: "expo run:android", test: "node --test" } });
  assert.deepEqual(original, saved);
});

test("prebuild cleanup does not overwrite custom user commands or a multi-platform package", () => {
  const custom = { scripts: { ios: "custom command", web: "custom build" } };
  assert.deepEqual(normalizeAndroidPackage(custom, ["android"]), custom);
  assert.equal(normalizeAndroidPackage(custom, ["android", "ios"]), custom);
});

test("local Android runs and signed builds both use the normalization step", () => {
  const scripts = json(`${mobile}package.json`).scripts;
  assert.match(scripts["prebuild:android"], /--platform android.*normalize-android-package/);
  assert.match(scripts.android, /pnpm prebuild:android/);
  assert.match(text(`${mobile}scripts/build-release.ps1`), /pnpm run prebuild:android/);
});
