import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPowerCatalog, validatePowerPlan } from "./build-power-catalog.mjs";

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const source = read("./catalog-male-v3.json");
const plan = read("./visual-power-v4.json");
const copy = () => structuredClone(plan);

test("all 81 identities survive the art reorder; source catalog is not mutated", () => {
  const before = JSON.stringify(source);
  const result = buildPowerCatalog(source, plan);
  assert.deepEqual(result.levels.map((level) => level.id), Array.from({ length: 81 }, (_, id) => id));
  assert.equal(new Set(result.levels.map((level) => level.sourceCatalogId)).size, 81);
  assert.equal(JSON.stringify(source), before);
  assert.equal(result.integrationStatus, "integrated");
  assert.equal(result.implementationRelease, "1.1.4");
  assert.equal(result.normsAndProgressUnchanged, true);
  assert.equal(result.femalePolicy, "preserve-current-labels-and-original-art");
});

test("first Rocky remains the style reference, not the rejected coarse edit", () => {
  const original = readFileSync(new URL(`./${plan.styleReference}`, import.meta.url));
  assert.equal(createHash("sha256").update(original).digest("hex"), plan.styleReferenceSha256);
  const wrong = copy();
  wrong.styleReference = "pixel-study-v4/rocky-candidate.png";
  assert.throws(() => validatePowerPlan(wrong));
});

test("replacement heroes retain numeric IDs and the correct reference group", () => {
  const catalog = buildPowerCatalog(source, plan);
  assert.equal(catalog.levels[59].name, "Арагорн после похода");
  assert.equal(catalog.levels[59].sourceCatalogId, 62);
  assert.ok(catalog.referenceGroups.screen.includes(59));
  assert.ok(!catalog.referenceGroups.games.includes(59));
  assert.equal(catalog.levels[70].name, "Дредд по регламенту");
  assert.equal(catalog.levels[71].name, "Бэйн у стойки");
  const wrong = copy();
  wrong.referenceGroupOverrides[62] = "unknown";
  assert.throws(() => validatePowerPlan(wrong), /Unknown reference group/);
});

test("every portrait receives its current band body and stance instructions", () => {
  const catalog = buildPowerCatalog(source, plan);
  for (const level of catalog.levels) {
    const band = plan.bands[Math.floor(level.id / 9)];
    assert.equal(level.visualPower.band, band.id);
    assert.ok(level.visual.includes(band.body));
    assert.ok(level.visual.includes(band.stance));
  }
  assert.equal(catalog.levels[1].sourceCatalogId, 1);
  assert.equal(catalog.levels[30].sourceCatalogId, 30);
  assert.equal(catalog.levels[80].sourceCatalogId, 80);
});

test("duplicate, missing or unknown source IDs fail before generation", () => {
  for (const value of [0, 81]) {
    const wrong = copy();
    wrong.orderedSourceIds[30] = value;
    assert.throws(() => validatePowerPlan(wrong), /permutation/);
  }
  const missing = copy();
  missing.orderedSourceIds.pop();
  assert.throws(() => validatePowerPlan(missing), /permutation/);
});

test("a comic civilian cannot move above action heroes again", () => {
  const wrong = copy();
  const doc = wrong.orderedSourceIds.indexOf(60);
  const dutch = wrong.orderedSourceIds.indexOf(63);
  [wrong.orderedSourceIds[doc], wrong.orderedSourceIds[dutch]] = [wrong.orderedSourceIds[dutch], wrong.orderedSourceIds[doc]];
  assert.throws(() => validatePowerPlan(wrong), /Visual power inversion/);
});

test("beginner versus level 30 must retain a wide power separation", () => {
  const wrong = copy();
  [wrong.orderedSourceIds[1], wrong.orderedSourceIds[30]] = [wrong.orderedSourceIds[30], wrong.orderedSourceIds[1]];
  assert.throws(() => validatePowerPlan(wrong), /Visual power inversion/);
});

test("zoom, prop fitting, smaller margins or shifted band boundaries fail", () => {
  for (const key of ["autoFitToProps", "artificialZoomAsPower"]) {
    const wrong = copy();
    wrong.frame[key] = true;
    assert.throws(() => validatePowerPlan(wrong));
  }
  const margin = copy();
  margin.frame.minOuterMarginFraction = 0.01;
  assert.throws(() => validatePowerPlan(margin));
  const band = copy();
  band.bands[3].from--;
  assert.throws(() => validatePowerPlan(band));
});

test("small Yoda is replaced, Atlas stays last, Rocky has an explicit new art ID", () => {
  const catalog = buildPowerCatalog(source, plan);
  assert.equal(catalog.levels[72].name, "Колосс после смены");
  assert.ok(!catalog.levels.some((level) => level.reference.includes("Йода")));
  assert.equal(catalog.levels[29].name, "Рокки на районе");
  assert.equal(catalog.levels[29].sourceCatalogId, 15);
  assert.equal(catalog.levels.at(-1).name, "Атлас");
});

test("plan cannot alter sex, norms or identity through overrides", () => {
  const female = copy();
  female.femalePolicy = "redesign";
  assert.throws(() => validatePowerPlan(female));
  const norms = copy();
  norms.normsAndProgressUnchanged = false;
  assert.throws(() => validatePowerPlan(norms));
  const override = copy();
  override.characterOverrides[30].id = 1;
  assert.throws(() => validatePowerPlan(override), /rewrite IDs/);
});
