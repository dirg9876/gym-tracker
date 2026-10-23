import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve("expo"));
const prebuildRequire = createRequire(expoRequire.resolve("@expo/prebuild-config"));
const imageRequire = createRequire(prebuildRequire.resolve("@expo/image-utils"));
const Jimp = imageRequire("jimp-compact");
const { expo } = JSON.parse(await fs.readFile(path.join(root, "app.json"), "utf8"));

test("Gym-Beam branding preserves the installed application and EAS identity", () => {
  assert.equal(expo.name, "Gym-Beam");
  assert.equal(expo.android.package, "com.dirg9876.gymtracker");
  assert.equal(expo.slug, "gym-tracker-mobile");
  assert.equal(expo.scheme, "gym-tracker-mobile");
  assert.equal(expo.extra.eas.projectId, "dabd3128-415f-4a2f-8c73-3b0a52585149");
});

test("Android launcher and splash use the glass logo with a padded native layer", async () => {
  assert.equal(expo.splash.image, expo.icon);
  assert.deepEqual(expo.platforms, ["android"]);
  assert.equal(expo.web, undefined);
  assert.notEqual(expo.android.adaptiveIcon.foregroundImage, expo.icon);
  const icon = await Jimp.read(path.resolve(root, expo.icon));
  const adaptive = await Jimp.read(path.resolve(root, expo.android.adaptiveIcon.foregroundImage));
  assert.equal(icon.bitmap.width, icon.bitmap.height);
  assert.ok(icon.bitmap.width >= 1024);
  assert.equal(adaptive.bitmap.width, 1024);
  assert.equal(adaptive.bitmap.height, 1024);
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) {
    assert.equal(adaptive.getPixelColor(x, y), 0x000000ff);
  }
  let colored = 0;
  adaptive.scan(0, 0, 1024, 1024, (x, y, offset) => {
    const [r, g, b] = adaptive.bitmap.data.subarray(offset, offset + 3);
    if (r > 150 && g > 50 && b < 100) colored++;
    if (Math.max(r, g, b) > 80) {
      assert.ok(x >= 128 && x < 896 && y >= 128 && y < 896, "Artwork escaped padded layer");
    }
  });
  assert.ok(colored > 10000, "Glass artwork is blank or missing its orange color");
});
