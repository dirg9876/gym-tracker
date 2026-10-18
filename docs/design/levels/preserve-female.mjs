import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { getLevelLabels } from "../../../lib/level-data/src/index.ts";

const source = new URL("../../../artifacts/gym-tracker/src/assets/levels/", import.meta.url);
const baselineUrl = new URL("./female-baseline-v1.json", import.meta.url);
const images = readdirSync(source).filter((name) => /^(level|tier)-\d+-f\.png$/u.test(name)).sort();
const current = {
  policy: "Preserve the existing female names, captions and original artwork byte-for-byte",
  labels: getLevelLabels("female"),
  images: Object.fromEntries(images.map((file) => [file, createHash("sha256").update(readFileSync(new URL(file, source))).digest("hex")])),
};

assert.equal(current.labels.length, 81);
assert.equal(images.filter((file) => file.startsWith("level-")).length, 81);
assert.equal(images.filter((file) => file.startsWith("tier-")).length, 9);
if (process.argv.includes("--capture")) {
  assert.ok(!existsSync(baselineUrl), "Never overwrite the original female baseline");
  writeFileSync(baselineUrl, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
} else {
  assert.deepEqual(current, JSON.parse(readFileSync(baselineUrl, "utf8")), "Female gallery must remain unchanged");
}
console.log("Female baseline: 81 labels and 90 original image hashes PASS");
