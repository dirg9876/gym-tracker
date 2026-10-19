import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const mobile = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require(specifier) {
    if (specifier.startsWith("@/assets/levels/")) {
      const asset = resolve(mobile, specifier.replace("@/", ""));
      assert.ok(existsSync(asset), `Missing bundled asset ${asset}`);
      return specifier;
    }
    return load(resolve(dirname(file), `${specifier}.ts`));
  } }, { filename: file });
  return module.exports;
}
const { levelImage, tierImage, MALE_PORTRAIT_INSET } = load(resolve(mobile, "lib/levelImages.ts"));

test("all81 portraits select the correct sex; default stays male", () => {
  for (let id = 0; id <= 80; id++) {
    assert.equal(levelImage(id, 0), `@/assets/levels/level-${id}.png`);
    assert.equal(levelImage(id, 0, "male"), `@/assets/levels/level-${id}.png`);
    assert.equal(levelImage(id, 0, "female"), `@/assets/levels/level-${id}-f.png`);
  }
});

test("all9 tier fallbacks preserve sex, including invalid level inputs", () => {
  for (let id = 0; id < 9; id++) {
    for (const sex of ["male", "female"]) {
      const expected = `@/assets/levels/tier-${id}${sex === "female" ? "-f" : ""}.png`;
      assert.equal(tierImage(id, sex), expected);
      for (const invalid of [-1, 81, 0.5, NaN, Infinity]) assert.equal(levelImage(invalid, id, sex), expected);
    }
  }
});

test("tier indices are finite, clamped and integer rather than undefined", () => {
  for (const sex of ["male", "female"]) {
    for (const invalid of [-1, NaN, Infinity, -Infinity]) assert.equal(tierImage(invalid, sex), tierImage(0, sex));
    assert.equal(tierImage(99, sex), tierImage(8, sex));
    assert.equal(tierImage(4.9, sex), tierImage(4, sex));
  }
});

test("every bundled female PNG is byte-identical to the protected original", () => {
  const baseline = JSON.parse(readFileSync(resolve(mobile, "../../docs/design/levels/female-baseline-v1.json"), "utf8"));
  assert.equal(Object.keys(baseline.images).length, 90);
  for (const [file, sha] of Object.entries(baseline.images)) {
    const actual = createHash("sha256").update(readFileSync(resolve(mobile, "assets/levels", file))).digest("hex");
    assert.equal(actual, sha, file);
  }
});

test("all installed male portraits and tier fallbacks match the reviewed source on both platforms", () => {
  const design = resolve(mobile, "../../docs/design/levels");
  const manifest = JSON.parse(readFileSync(resolve(design, "male-generation-v4.sources.json"), "utf8"));
  const catalog = JSON.parse(readFileSync(resolve(design, "catalog-male-v4.json"), "utf8"));
  const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
  assert.equal(manifest.sources.length, 81);
  const labels = load(resolve(mobile, "../../lib/level-data/src/index.ts")).getLevelLabels("male");
  assert.equal(JSON.stringify(labels), JSON.stringify(catalog.levels.map(({ name, caption }) => [name, caption])));
  for (const entry of manifest.sources) {
    assert.equal(entry.reviewed, true, `Unreviewed ${entry.id}`);
    assert.equal(entry.name, catalog.levels[entry.id].name);
    for (const assets of [resolve(mobile, "assets/levels"), resolve(mobile, "../gym-tracker/src/assets/levels")]) {
      assert.equal(sha(resolve(assets, `level-${entry.id}.png`)), entry.sha256);
    }
  }
  for (const { id, to } of catalog.chapters) {
    const expected = manifest.sources.find((entry) => entry.id === to).sha256;
    for (const assets of [resolve(mobile, "assets/levels"), resolve(mobile, "../gym-tracker/src/assets/levels")]) {
      assert.equal(sha(resolve(assets, `tier-${id}.png`)), expected);
    }
  }
});

test("male portrait frame uses one fixed inset, not a per-level zoom", () => {
  assert.equal(MALE_PORTRAIT_INSET, 0.06);
  const component = readFileSync(resolve(mobile, "components/LevelPortrait.tsx"), "utf8");
  assert.match(component, /levelImage\(level, tier, sex\)/);
  assert.match(component, /sex === "male" \? size \* MALE_PORTRAIT_INSET : 0/);
  const screen = readFileSync(resolve(mobile, "app/(tabs)/levels.tsx"), "utf8");
  assert.equal((screen.match(/<LevelPortrait[^>]*sex=\{data.sex\}/g) ?? []).length, 3);
  assert.match(screen, /size=\{96\}/);
  assert.match(screen, /size=\{216\}/);
  assert.match(screen, /width >= 400 \? 192 : 160/);
});

test("portrait upgrades bypass persistent drawable caches without clearing other app data", () => {
  const component = readFileSync(resolve(mobile, "components/LevelPortrait.tsx"), "utf8");
  assert.match(component, /cachePolicy="memory"/);
  assert.doesNotMatch(component, /clearDiskCache|clearMemoryCache|AsyncStorage\.clear/);
});
