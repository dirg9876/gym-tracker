import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateCatalog } from "./validate-catalog.mjs";

const original = JSON.parse(readFileSync(new URL("./catalog-male-v3.json", import.meta.url), "utf8"));
const copy = () => structuredClone(original);

test("male-only catalog keeps all 81 numeric IDs without changing the female policy", () => {
  const result = validateCatalog(original);
  assert.equal(result.uniqueNames, 81);
  assert.equal(result.uniqueCaptions, 81);
  assert.equal(result.men, 81);
  assert.equal(result.women, 0);
});

test("missing or reordered levels fail instead of silently shifting progress IDs", () => {
  const missing = copy();
  missing.levels.splice(9, 1);
  assert.throws(() => validateCatalog(missing), /exactly IDs/);
  const reordered = copy();
  [reordered.levels[9], reordered.levels[10]] = [reordered.levels[10], reordered.levels[9]];
  assert.throws(() => validateCatalog(reordered), /reordered ID/);
});

test("near-identical names with case or yo/e substitutions fail", () => {
  const duplicate = copy();
  duplicate.levels[10].name = "лЕвШа";
  assert.throws(() => validateCatalog(duplicate), /Duplicate name/);
  const yo = copy();
  yo.levels[10].name = "АРНИ ПОСЛЕ СЪЕМОК";
  assert.throws(() => validateCatalog(yo), /Duplicate name/);
});

test("repeated captions and oversized text fail", () => {
  const repeated = copy();
  repeated.levels[3].caption = repeated.levels[2].caption;
  assert.throws(() => validateCatalog(repeated), /Duplicate caption/);
  const wide = copy();
  wide.levels[3].name = "А".repeat(25);
  assert.throws(() => validateCatalog(wide), /exceeds 24/);
  wide.levels[3].name = "Короткое имя";
  wide.levels[3].caption = "А".repeat(81);
  assert.throws(() => validateCatalog(wide), /exceeds 80/);
});

test("separate art does not remove sex-specific norms", () => {
  const wrong = copy();
  wrong.sexAffectsNorms = false;
  assert.throws(() => validateCatalog(wrong), /must still affect norms/);
});

test("blank visual instructions and invalid chapter boundaries fail", () => {
  const blank = copy();
  blank.levels[4].visual = "";
  assert.throws(() => validateCatalog(blank), /empty visual/);
  const chapter = copy();
  chapter.chapters[3].from = 26;
  assert.throws(() => validateCatalog(chapter));
});

test("mixed cast, shared gallery and unreviewed production claims fail", () => {
  const cast = copy();
  cast.levels[23].portrayal = "woman";
  assert.throws(() => validateCatalog(cast), /male characters/);
  const shared = copy();
  shared.galleryModel = "shared";
  assert.throws(() => validateCatalog(shared), /separates male and female/);
  const production = copy();
  production.integrationStatus = "shipped";
  assert.throws(() => validateCatalog(production));
});

test("the female gallery must be explicitly preserved, not regenerated", () => {
  const changed = copy();
  changed.femalePolicy = "redesign";
  assert.throws(() => validateCatalog(changed));
});

test("adult direction and complete non-overlapping reference groups are required", () => {
  const juvenile = copy();
  juvenile.audience = "children";
  assert.throws(() => validateCatalog(juvenile), /adult-audience/);
  const missing = copy();
  missing.referenceGroups.games.pop();
  assert.throws(() => validateCatalog(missing), /cover every ID/);
  const duplicate = copy();
  duplicate.referenceGroups.screen.push(23);
  assert.throws(() => validateCatalog(duplicate), /cover every ID/);
});
