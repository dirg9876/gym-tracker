import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../artifacts/gym-tracker/package.json", import.meta.url));
const { PNG } = require("pngjs");
const catalog = JSON.parse(readFileSync(new URL("./catalog-male-v3.json", import.meta.url), "utf8"));
const staging = new URL("../../../artifacts/apk/verified/level-art-male-v3/", import.meta.url);
const images = catalog.levels.map((level) => {
  const file = `level-${level.id}.png`;
  const url = new URL(file, staging);
  if (!existsSync(url)) return { id: level.id, file, status: "missing" };
  const buffer = readFileSync(url);
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  assert.equal(width, height, `${file}: expected square canvas`);
  assert.ok(width >= 384 && width <= 2048, `${file}: unexpected size`);
  let transparent = 0;
  let opaqueLike = 0;
  const bounds = { left: width, top: height, right: -1, bottom: -1 };
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (alpha === 0) transparent++;
    if (alpha >= 240) opaqueLike++;
    if (alpha >= 200) {
      const pixel = (i - 3) / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y);
    }
  }
  const corners = [data[3], data[(width - 1) * 4 + 3], data[(height - 1) * width * 4 + 3], data[data.length - 1]];
  assert.ok(corners.every((a) => a <= 5), `${file}: corner is not transparent`);
  assert.ok(transparent > width * height * 0.2, `${file}: no real transparent background`);
  assert.ok(opaqueLike > width * height * 0.05, `${file}: subject is empty or translucent`);
  const margin = Math.min(bounds.left, bounds.top, width - 1 - bounds.right, height - 1 - bounds.bottom);
  assert.ok(margin >= 4, `${file}: figure may be clipped at edge`);
  return { id: level.id, file, status: "technical-pass-needs-visual-review", width, height,
    bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"),
    transparent, opaqueLike, bounds, minimumMargin: margin, cornerAlpha: corners };
});
const missing = images.filter((item) => item.status === "missing").map((item) => item.id);
const report = { gallery: "male", required: 81, generated: 81 - missing.length, missing,
  warning: "Technical PNG checks do not prove correct anatomy, character identity or native UI legibility", images };
if (process.argv.includes("--require-all")) assert.equal(missing.length, 0, `Missing art IDs: ${missing.join(",")}`);
if (process.argv.includes("--write-report")) writeFileSync(new URL("art-status.json", staging), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(process.argv.includes("--summary")
  ? { generated: report.generated, required: report.required, missing: report.missing, warning: report.warning }
  : report, null, 2));
