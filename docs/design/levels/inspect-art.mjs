import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../../../scripts/package.json", import.meta.url));
const { PNG } = require("pngjs");
const artifacts = [
  { file: "style-study-v2.png", role: "current adult concept sheet, deliberately opaque" },
  { file: "style-study-v1.png", role: "superseded cute-style concept sheet" },
  { file: "masters-v1/level-000.png", role: "superseded transparent candidate, not production art" },
];

const report = artifacts.map(({ file, role }) => {
  const buffer = readFileSync(new URL(file, import.meta.url));
  const { width, height, data } = PNG.sync.read(buffer);
  let transparent = 0;
  let opaqueLike = 0;
  let partial = 0;
  const bounds = { left: width, top: height, right: -1, bottom: -1 };
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (alpha === 0) transparent++;
    else if (alpha >= 250) opaqueLike++;
    else partial++;
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
  return {
    file,
    role,
    width,
    height,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    transparent,
    opaqueLike,
    partial,
    contentBoundsAtAlpha200: bounds,
    cornerAlpha: [data[3], data[(width - 1) * 4 + 3], data[(height - 1) * width * 4 + 3], data[data.length - 1]],
  };
});

if (process.argv.includes("--write-report")) {
  writeFileSync(new URL("./art-qa-v2.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(report, null, 2));
