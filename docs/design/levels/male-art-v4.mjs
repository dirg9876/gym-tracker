import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const spec = read("./male-generation-v4.json");
const catalog = read(`./${spec.catalog}`);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const staging = resolve(root, spec.staging);
const logUrl = new URL("./male-generation-v4.sources.json", import.meta.url);
const hash = (raw) => createHash("sha256").update(raw).digest("hex");
const save = (url, value) => writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const log = existsSync(logUrl) ? read("./male-generation-v4.sources.json") : { mode: spec.mode, sources: [] };
const idOf = (value) => {
  const id = Number(value);
  assert.ok(Number.isInteger(id) && id >= 0 && id <= 80, "Invalid level ID");
  return id;
};
const request = (id) => {
  assert.equal(spec.generationEnabled, true, "Generation disabled");
  if (spec.allowedIds) assert.ok(spec.allowedIds.includes(id), "Outside the explicitly authorized portrait revision");
  assert.ok(!spec.blockedIds?.includes(id), "This character is blocked pending a user-approved distinct replacement; do not retry it unchanged");
  if (spec.argumentOverrides?.[id]) return spec.argumentOverrides[id];
  if (spec.framingSources?.[id]) return {
    prompt: "Edit ONLY the outer framing of this supplied existing full-body adult gym pixel portrait. Preserve exactly the same character, face, hairstyle, outfit, anatomy, muscular build, pose, every held object, colors and pixel-block density. Add a modest transparent border so the complete figure occupies about86% of square canvas height, with AT LEAST5% fully clear space above the hair and below the lowest shoe. Same figure, only uniform modest reduction for safe margins. Do not crop, add new objects, text, background, floor, shadows or glow. Do not add detail or change style. Genuinely transparent exterior, opaque character interior.",
    referenced_image_paths: [spec.framingSources[id]],
    transparent_background: true,
  };
  const item = catalog.levels[id];
  assert.equal(item.id, id);
  return {
    prompt: `${spec.promptPrefix}\n${spec.powerEnglish[item.visualPower.band]}\nSubject: ${spec.subjectOverrides[id] ?? `${item.name}; ${item.reference}. ${item.visual}`}\n${spec.identityReferences?.[id]?.role ?? ""}\nCaption for mood only, do NOT print it: ${item.caption}`,
    referenced_image_paths: [spec.reference, ...(spec.identityReferences?.[id] ? [spec.identityReferences[id].path] : [])],
    transparent_background: true,
  };
};

const [command, ...args] = process.argv.slice(2);
if (command === "request") {
  console.log(JSON.stringify(request(idOf(args[0]))));
} else if (command === "record") {
  const id = idOf(args[0]);
  const source = resolve(args[1] || "");
  assert.match(source, /^C:\\Users\\Dirg9\\\.codex\\generated_images\\[a-zA-Z0-9-]+\\exec-[a-zA-Z0-9-]+\.png$/u, "Expected built-in image_gen output");
  mkdirSync(staging, { recursive: true });
  const sha256 = hash(readFileSync(source));
  const destination = resolve(staging, `level-${id}.png`);
  const existing = log.sources.find((item) => item.id === id);
  if (existsSync(destination) && hash(readFileSync(destination)) !== sha256) {
    const rejected = resolve(staging, "superseded");
    mkdirSync(rejected, { recursive: true });
    const archived = resolve(rejected, `level-${id}-${hash(readFileSync(destination)).slice(0, 12)}.png`);
    if (!existsSync(archived)) copyFileSync(destination, archived, constants.COPYFILE_EXCL);
  }
  copyFileSync(source, destination);
  const entry = { id, name: catalog.levels[id].name, sourceCatalogId: catalog.levels[id].sourceCatalogId,
    source, destination, sha256, args: request(id), reviewed: false,
    ...(existing ? { supersedes: existing.sha256 } : {}) };
  if (existing) (log.superseded ??= []).push(existing);
  log.sources = [...log.sources.filter((item) => item.id !== id), entry].sort((a, b) => a.id - b.id);
  save(logUrl, log);
  console.log(`Saved ${id}: ${entry.name}; ${log.sources.length}/81 generated`);
} else if (command === "fail") {
  const id = idOf(args[0]);
  (log.failures ??= []).push({ id, reason: args[1] ?? "image_gen returned no accepted output" });
  save(logUrl, log);
  console.log(`Recorded failed generation ${id}; no output installed`);
} else if (command === "rename") {
  const id = idOf(args[0]);
  const entry = log.sources.find((item) => item.id === id);
  assert.ok(entry, "Missing generated portrait");
  assert.equal(entry.name, args[1], "Provide the exact previous name for this explicit label correction");
  (entry.labelChanges ??= []).push({ from: entry.name, to: catalog.levels[id].name });
  entry.name = catalog.levels[id].name;
  entry.reviewed = false;
  save(logUrl, log);
  console.log(`Renamed metadata ${id}: ${entry.name}; requires visual review again`);
} else if (command === "approve") {
  for (const raw of args) {
    const id = idOf(raw);
    const entry = log.sources.find((item) => item.id === id);
    assert.ok(entry, `Missing generated image ${id}`);
    assert.equal(hash(readFileSync(entry.destination)), entry.sha256);
    entry.reviewed = true;
  }
  save(logUrl, log);
  console.log(`${log.sources.filter((item) => item.reviewed).length}/81 visually reviewed`);
} else if (command === "audit") {
  assert.equal(new Set(log.sources.map((entry) => entry.id)).size, log.sources.length, "Duplicate portrait IDs");
  assert.equal(new Set(log.sources.map((entry) => entry.sha256)).size, log.sources.length, "Duplicate portrait bitmap");
  const require = createRequire(new URL("../../../scripts/package.json", import.meta.url));
  const { PNG } = require("pngjs");
  const images = [];
  for (const entry of log.sources) {
    const raw = readFileSync(entry.destination);
    assert.equal(hash(raw), entry.sha256, `Changed source ${entry.id}`);
    const png = PNG.sync.read(raw);
    let clear = 0, core = 0;
    const bounds = [png.width, png.height, -1, -1];
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (!alpha) clear++;
      if (alpha >= 245) {
        core++;
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
      }
    }
    const margin = Math.min(bounds[0] / png.width, bounds[1] / png.height,
      (png.width - 1 - bounds[2]) / png.width, (png.height - 1 - bounds[3]) / png.height);
    const problems = [];
    if (png.width !== png.height || png.width < 512 || png.width > 2048) problems.push("square-size");
    if (clear / (png.width * png.height) < 0.2 || core / (png.width * png.height) < 0.05) problems.push("transparency/core");
    const viewportMargin = 0.06 + margin * 0.88;
    if (margin < 0.02 || viewportMargin < 0.06) problems.push("source-margin/clipping");
    images.push({ id: entry.id, width: png.width, height: png.height, bounds, margin, viewportMargin, reviewed: entry.reviewed, problems });
  }
  const missing = catalog.levels.filter((item) => !log.sources.some((entry) => entry.id === item.id)).map((item) => item.id);
  const result = { generated: images.length, reviewed: images.filter((item) => item.reviewed).length,
    missing, failures: images.filter((item) => item.problems.length), images };
  mkdirSync(staging, { recursive: true });
  save(resolve(staging, "audit.json"), result);
  console.log(JSON.stringify({ ...result, images: undefined }, null, 2));
  if (args.includes("--require-all")) assert.ok(!missing.length && !result.failures.length && result.reviewed === 81, "Gallery incomplete or unreviewed");
} else {
  throw new Error("Use request <id>, record <id> <source>, fail <id> <reason>, rename <id> <old name>, approve <ids>, audit [--require-all]");
}
