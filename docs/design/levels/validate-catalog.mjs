import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const catalogUrl = new URL("./catalog-male-v3.json", import.meta.url);

const nameKey = (value) => value.normalize("NFC").toLocaleLowerCase("ru").replaceAll("ё", "е");

export function validateCatalog(catalog, { expectedIntegration = "not-integrated" } = {}) {
  assert.equal(catalog.schemaVersion, 1, "Unsupported catalog schema");
  assert.ok(["not-integrated", "integrated"].includes(expectedIntegration));
  assert.equal(catalog.status, expectedIntegration === "integrated" ? "integrated" : "editorial-draft", "Unexpected catalog approval state");
  assert.equal(catalog.integrationStatus, expectedIntegration);
  if (expectedIntegration === "integrated") assert.match(catalog.implementationRelease, /^\d+\.\d+\.\d+$/);
  assert.equal(catalog.galleryModel, "sex-specific", "The latest decision separates male and female galleries");
  assert.equal(catalog.sex, "male");
  assert.equal(catalog.femalePolicy, "preserve-current-labels-and-original-art");
  assert.equal(catalog.sexAffectsNorms, true, "Profile sex must still affect norms");
  assert.equal(catalog.normsAndProgressUnchanged, true);
  assert.equal(catalog.audience, "adult", "Keep the user's adult-audience direction");
  assert.equal(catalog.chapters.length, 9);
  assert.equal(catalog.levels.length, 81, "Expected exactly IDs 0 through 80");

  for (const [index, chapter] of catalog.chapters.entries()) {
    assert.equal(chapter.id, index);
    assert.equal(chapter.from, index * 9);
    assert.equal(chapter.to, index * 9 + 8);
    assert.ok(chapter.name.trim());
  }

  const names = new Set();
  const captions = new Set();
  for (const [index, level] of catalog.levels.entries()) {
    assert.equal(level.id, index, `Missing, duplicate or reordered ID at index ${index}`);
    for (const field of ["name", "caption", "reference", "visual"]) {
      assert.equal(typeof level[field], "string", `Level ${index}: missing ${field}`);
      assert.equal(level[field], level[field].trim(), `Level ${index}: whitespace in ${field}`);
      assert.ok(level[field].length > 0, `Level ${index}: empty ${field}`);
      assert.ok(!/[\r\n|]/u.test(level[field]), `Level ${index}: unsupported table formatting`);
    }
    assert.ok([...level.name].length <= 24, `Level ${index}: name exceeds 24 characters`);
    assert.ok([...level.caption].length <= 80, `Level ${index}: caption exceeds 80 characters`);
    assert.ok(!names.has(nameKey(level.name)), `Duplicate name: ${level.name}`);
    assert.ok(!captions.has(nameKey(level.caption)), `Duplicate caption: ${level.caption}`);
    assert.equal(level.portrayal, "man", `Level ${index}: male gallery must contain male characters`);
    assert.ok(["replace", "redraw"].includes(level.decision), `Level ${index}: missing art decision`);
    names.add(nameKey(level.name));
    captions.add(nameKey(level.caption));
  }

  assert.equal(catalog.levels[0].name, "Новичок");
  assert.equal(catalog.levels[9].name, "Левша");
  assert.equal(catalog.levels[80].name, "Атлас");
  const women = catalog.levels.filter((level) => level.portrayal === "woman").length;
  assert.equal(women, 0);
  const groupedIds = Object.values(catalog.referenceGroups).flat().sort((a, b) => a - b);
  assert.deepEqual(groupedIds, catalog.levels.map((level) => level.id), "Reference groups must cover every ID exactly once");
  assert.ok(catalog.referenceGroups.screen.length + catalog.referenceGroups.games.length >= 60,
    "Screen and game characters should dominate, not fairy tales");

  return {
    levels: catalog.levels.length,
    chapters: catalog.chapters.length,
    uniqueNames: names.size,
    uniqueCaptions: captions.size,
    women,
    men: 81 - women,
    retainedIdeas: catalog.levels.filter((level) => level.decision === "redraw").length,
    references: Object.fromEntries(Object.entries(catalog.referenceGroups).map(([key, ids]) => [key, ids.length])),
    maxNameLength: Math.max(...catalog.levels.map((level) => [...level.name].length)),
    maxCaptionLength: Math.max(...catalog.levels.map((level) => [...level.caption].length)),
    artCompleteness: "Not checked: a complete text catalog does not mean 81 finished sprites",
  };
}

function renderCatalog(catalog) {
  const lines = [
    "# Gym-Beam: Мужской Каталог 81 Уровня",
    "",
    "18.10.2026: взрослый стиль утверждён, но пользователь изменил решение о галерее. Мужская и женская линейки разделены. Этот каталог обновляет только мужскую, женская остаётся прежней. Это не опубликованное обновление приложения.",
    "",
    "Мужские персонажи для мужского профиля. Женские тексты и исходные изображения зафиксированы отдельно без редактирования. Спортивные нормативы, IDs и прогресс не меняются. Порядок глав не является каноническим рейтингом силы героев разных вселенных.",
    "",
    "Источник: [catalog-male-v3.json](catalog-male-v3.json). Таблица генерируется командой `node docs/design/levels/validate-catalog.mjs --write-table`. Имена и подписи следует править в JSON, а не в этой таблице. Рисовка и область изменений: [мужская версия](art-direction-male-v3.md).",
    "",
    "Все рисунки предполагают единую перерисовку. «Сохранить идею» не означает оставить старый PNG без проверки качества. Современные экранные образы здесь являются творческими референсами, а не заявлением о свободных правах на персонажей.",
  ];
  for (const chapter of catalog.chapters) {
    lines.push("", `## ${chapter.from}-${chapter.to}: ${chapter.name}`, "", "| Уровень | Имя | Подпись | Идея рисунка |", "| --- | --- | --- | --- |");
    for (const level of catalog.levels.slice(chapter.from, chapter.to + 1)) {
      lines.push(`| ${level.id} | ${level.name} | ${level.caption} | ${level.visual} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const catalog = JSON.parse(readFileSync(catalogUrl, "utf8"));
  const result = validateCatalog(catalog);
  if (process.argv.includes("--write-table")) {
    writeFileSync(new URL("./catalog-male-v3.md", import.meta.url), renderCatalog(catalog), "utf8");
  }
  console.log(JSON.stringify(result, null, 2));
}
