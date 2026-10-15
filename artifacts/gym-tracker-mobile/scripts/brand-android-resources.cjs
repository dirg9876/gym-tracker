const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const expoRequire = createRequire(require.resolve("expo"));
const prebuildPath = expoRequire.resolve("@expo/prebuild-config");
const prebuildRequire = createRequire(prebuildPath);
const { XML } = prebuildRequire("@expo/config-plugins");
const { generateImageAsync, getPngInfo } = prebuildRequire("@expo/image-utils");
const { setIconAsync } = require(path.join(path.dirname(prebuildPath), "plugins/icons/withAndroidIcons"));
const { configureManifest, resourceName } = require("../plugins/withCoachNetworkSecurity.cjs");

async function brand(decoded) {
  if (!decoded) throw new Error("Expected an apktool decoded directory");
  decoded = path.resolve(decoded);
  const { expo: config } = JSON.parse(await fs.readFile(path.join(root, "app.json"), "utf8"));
  const res = path.join(decoded, "res");
  const changed = new Set();
  const manifestPath = path.join(decoded, "AndroidManifest.xml");
  const manifest = await XML.readXMLAsync({ path: manifestPath });
  configureManifest(manifest);
  await XML.writeXMLAsync({ path: manifestPath, xml: manifest });
  await fs.mkdir(path.join(res, "xml"), { recursive: true });
  await fs.copyFile(path.join(root, `assets/android/${resourceName}.xml`), path.join(res, "xml", `${resourceName}.xml`));
  for (const directory of await fs.readdir(res, { withFileTypes: true })) {
    if (!directory.isDirectory() || !directory.name.startsWith("values")) continue;
    const file = path.join(res, directory.name, "strings.xml");
    let strings;
    try { strings = await XML.readXMLAsync({ path: file }); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!strings) continue;
    let modified = false;
    for (const item of strings.resources.string ?? []) {
      if (item.$?.name !== "app_name") continue;
      item._ = config.name;
      modified = true;
    }
    if (modified) await XML.writeXMLAsync({ path: file, xml: strings });
  }
  const colorsPath = path.join(res, "values/colors.xml");
  const colors = await XML.readXMLAsync({ path: colorsPath });
  const background = colors.resources.color.find(item => item.$.name === "iconBackground");
  if (!background) throw new Error("Missing adaptive icon background");
  background._ = config.android.adaptiveIcon.backgroundColor;
  await XML.writeXMLAsync({ path: colorsPath, xml: colors });

  await setIconAsync(decoded, {
    icon: path.resolve(root, config.android.adaptiveIcon.foregroundImage),
    backgroundColor: config.android.adaptiveIcon.backgroundColor,
    isAdaptive: true,
  });
  const generated = path.join(decoded, "android/app/src/main/res");
  for (const directory of await fs.readdir(generated)) {
    for (const name of await fs.readdir(path.join(generated, directory))) {
      const relative = path.posix.join("res", directory, name);
      // Never introduce resource IDs into a repack of existing native code.
      await fs.access(path.join(decoded, relative));
      await fs.copyFile(path.join(generated, directory, name), path.join(decoded, relative));
      changed.add(relative);
    }
  }
  for (const directory of await fs.readdir(res)) {
    const file = path.join(res, directory, "splashscreen_logo.png");
    try { await fs.access(file); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    const { width, height } = await getPngInfo(file);
    const image = await generateImageAsync({ projectRoot: root, cacheType: "gymbeam-native-splash" }, {
      src: path.resolve(root, config.splash.image), width, height,
      resizeMode: "contain", backgroundColor: config.splash.backgroundColor,
    });
    await fs.writeFile(file, image.source);
    changed.add(path.posix.join("res", directory, "splashscreen_logo.png"));
  }
  if (changed.size < 15) throw new Error("Expected all launcher density variants");
  await fs.writeFile(path.join(decoded, "branding-files.json"), JSON.stringify([...changed]));
  console.log(`Branded ${changed.size} icon/splash resources as ${config.name}`);
}

brand(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
