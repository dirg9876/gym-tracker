import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateCatalog } from "./validate-catalog.mjs";

export function validatePowerPlan(plan) {
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.status, "design-contract-not-app-release");
  assert.equal(plan.galleryModel, "sex-specific");
  assert.equal(plan.sex, "male");
  assert.equal(plan.femalePolicy, "preserve-current-labels-and-original-art");
  assert.equal(plan.normsAndProgressUnchanged, true);
  assert.equal(plan.styleSelection, "first-Rocky-not-coarser-second");
  assert.equal(plan.styleReference, "pixel-study-v4/rocky-style-selected.png");
  assert.equal(plan.styleReferenceSha256, "d0e33abfd176b7bbe4a4c74578517620e3433a9eacb6e5f031b3dbf78ebdaee6");
  if (plan.implementationRelease) assert.match(plan.implementationRelease, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...plan.orderedSourceIds].sort((a, b) => a - b),
    Array.from({ length: 81 }, (_, id) => id), "Character order must be a permutation of all 81 source IDs");
  assert.equal(plan.orderedSourceIds[0], 0);
  assert.equal(plan.orderedSourceIds[9], 9);
  assert.equal(plan.orderedSourceIds[80], 80);
  assert.equal(plan.bands.length, 9);
  for (const [id, band] of plan.bands.entries()) {
    assert.equal(band.id, id);
    assert.equal(band.from, id * 9);
    assert.equal(band.to, id * 9 + 8);
    for (const field of ["name", "body", "stance"]) assert.ok(band[field]?.trim(), `Band ${id}: missing ${field}`);
  }
  assert.equal(plan.frame.canvasAspect, "1:1");
  assert.deepEqual(plan.frame.bodyHeightFraction, [0.76, 0.82]);
  assert.equal(plan.frame.baselineFraction, 0.91);
  assert.ok(plan.frame.minOuterMarginFraction >= 0.06);
  for (const key of ["sameHeadScale", "uniformPixelDensity"]) assert.equal(plan.frame[key], true);
  for (const key of ["autoFitToProps", "artificialZoomAsPower"]) assert.equal(plan.frame[key], false);
  for (const key of Object.keys(plan.characterOverrides)) {
    assert.ok(plan.orderedSourceIds.includes(Number(key)), `Unknown override source ${key}`);
    assert.ok(!["id", "sourceCatalogId", "visualPower", "portrayal"].some((field) => field in plan.characterOverrides[key]),
      "An art override must not rewrite IDs or gallery contracts");
  }
  for (const [key, group] of Object.entries(plan.referenceGroupOverrides ?? {})) {
    assert.ok(plan.orderedSourceIds.includes(Number(key)), "Unknown reference override source");
    assert.ok(["everyday", "literature", "screen", "games", "animeManga", "myth"].includes(group), "Unknown reference group");
  }
  const rank = (sourceId) => Math.floor(plan.orderedSourceIds.indexOf(sourceId) / 9);
  const requiredPairs = [[1, 30], [60, 15], [61, 63], [75, 58], [78, 77], [79, 47]];
  assert.deepEqual(plan.orderingConstraints.map(({ weakerSourceId, strongerSourceId }) => [weakerSourceId, strongerSourceId]),
    requiredPairs, "Keep the visual-power regression pairs");
  for (const pair of plan.orderingConstraints) {
    assert.ok(Number.isInteger(pair.minBandGap) && pair.minBandGap >= 2);
    assert.ok(rank(pair.strongerSourceId) - rank(pair.weakerSourceId) >= pair.minBandGap,
      `Visual power inversion between sources ${pair.weakerSourceId} and ${pair.strongerSourceId}`);
  }
}

export function buildPowerCatalog(source, plan) {
  validateCatalog(source);
  validatePowerPlan(plan);
  const newId = new Map(plan.orderedSourceIds.map((sourceId, id) => [sourceId, id]));
  const sourceGroup = new Map(Object.entries(source.referenceGroups).flatMap(([group, ids]) => ids.map((id) => [id, group])));
  const catalog = {
    ...structuredClone(source),
    ...(plan.implementationRelease ? { status: "integrated", integrationStatus: "integrated", implementationRelease: plan.implementationRelease } : {}),
    galleryDecision: "2026-10-19: ten less familiar male heroes replaced by Russian film characters from the 1990s/2000s; captions progress from early roasts to earned respect. First Rocky pixel style, visual power, female gallery and numeric progress/norms unchanged.",
    artDirection: "art-direction-male-v4.md",
    sourceCatalog: plan.sourceCatalog,
    visualPowerPlan: "visual-power-v4.json",
    powerMeaning: plan.powerMeaning,
    referenceGroups: Object.fromEntries(Object.keys(source.referenceGroups).map((group) =>
      [group, plan.orderedSourceIds.filter((id) => (plan.referenceGroupOverrides?.[id] ?? sourceGroup.get(id)) === group)
        .map((id) => newId.get(id))])),
    chapters: plan.bands.map(({ id, from, to, name }) => ({ id, from, to, name })),
    levels: plan.orderedSourceIds.map((sourceId, id) => {
      const { reason, ...override } = plan.characterOverrides[sourceId] ?? {};
      const band = plan.bands[Math.floor(id / 9)];
      const original = source.levels[sourceId];
      return {
        ...original,
        ...override,
        id,
        sourceCatalogId: sourceId,
        visualPower: { band: band.id, body: band.body, stance: band.stance },
        visual: `${override.visual ?? original.visual} Силуэт ступени: ${band.body} Стойка: ${band.stance}`,
        ...(reason ? { artChangeReason: reason } : {}),
      };
    }),
  };
  validateCatalog(catalog, { expectedIntegration: plan.implementationRelease ? "integrated" : "not-integrated" });
  return catalog;
}

function render(catalog) {
  const lines = [
    "# Gym-Beam: Мужской Каталог V4",
    "",
    `Каталог мужской галереи${catalog.implementationRelease ? `, внедрённой в код версии ${catalog.implementationRelease}` : " на стадии дизайна"}. Факт публикации APK и OTA указан в актуальном CHECKPOINT.md. Первый Рокки выбран как стиль. Порядок образов и телосложение учитывают визуальный рост силы; женская галерея и числовой прогресс не меняются.`,
    "",
    "Источник порядка: [visual-power-v4.json](visual-power-v4.json). Имена/подписи берутся из [v3](catalog-male-v3.json) с явными исключениями. Общие правила: [art-direction-male-v4.md](art-direction-male-v4.md). Исходный ID нужен только для происхождения дизайна, это НЕ миграция данных пользователя.",
    "",
    "Сборка: `node docs/design/levels/build-power-catalog.mjs --write`; проверка актуальности: та же команда без `--write`. Проверки плана не заменяют визуальную приёмку каждого PNG. Порядок не является каноническим рейтингом сражений персонажей разных вселенных.",
  ];
  for (const band of catalog.chapters) {
    const guide = catalog.levels[band.from].visualPower;
    lines.push("", `## ${band.from}-${band.to}: ${band.name}`, "", guide.body, "", guide.stance,
      "", "| Уровень | Имя | Подпись | Исходный ID v3 |", "| --- | --- | --- | --- |");
    for (const level of catalog.levels.slice(band.from, band.to + 1)) {
      lines.push(`| ${level.id} | ${level.name} | ${level.caption} | ${level.sourceCatalogId} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
  const plan = read("./visual-power-v4.json");
  assert.equal(createHash("sha256").update(readFileSync(new URL(`./${plan.styleReference}`, import.meta.url))).digest("hex"),
    plan.styleReferenceSha256, "The selected first Rocky source has changed");
  const catalog = buildPowerCatalog(read(`./${plan.sourceCatalog}`), plan);
  const files = [
    ["./catalog-male-v4.json", `${JSON.stringify(catalog, null, 2)}\n`],
    ["./catalog-male-v4.md", render(catalog)],
  ];
  for (const [name, content] of files) {
    const url = new URL(name, import.meta.url);
    if (process.argv.includes("--write")) writeFileSync(url, content, "utf8");
    else assert.equal(readFileSync(url, "utf8"), content, `${name}: regenerate with --write`);
  }
  console.log(JSON.stringify({ levels: catalog.levels.length, bands: catalog.chapters.length,
    female: "unchanged", integration: catalog.integrationStatus, artwork: "not validated by numeric plan", mode: process.argv.includes("--write") ? "written" : "checked" }));
}
