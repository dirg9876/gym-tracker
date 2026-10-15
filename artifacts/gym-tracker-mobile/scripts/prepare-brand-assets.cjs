const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const expoRequire = createRequire(require.resolve("expo"));
const prebuildRequire = createRequire(expoRequire.resolve("@expo/prebuild-config"));
const imageRequire = createRequire(prebuildRequire.resolve("@expo/image-utils"));
const Jimp = imageRequire("jimp-compact");

async function prepare() {
  const icon = await Jimp.read(path.join(root, "assets/images/gymbeam-icon.png"));
  // Android masks a 108dp layer to 72dp; keep the artwork inside its safe area.
  const foreground = new Jimp(1024, 1024, 0x000000ff);
  foreground.composite(icon.resize(768, 768), 128, 128);
  await foreground.writeAsync(path.join(root, "assets/images/gymbeam-adaptive.png"));
}

prepare().catch(error => { console.error(error); process.exitCode = 1; });
