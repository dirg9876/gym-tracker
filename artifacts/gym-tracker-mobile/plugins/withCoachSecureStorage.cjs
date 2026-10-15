const fs = require("node:fs/promises");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const resources = ["gymbeam_backup_rules", "gymbeam_data_extraction_rules"];
function configureManifest(manifest) {
  const application = manifest.manifest.application[0].$;
  application["android:fullBackupContent"] = `@xml/${resources[0]}`;
  application["android:dataExtractionRules"] = `@xml/${resources[1]}`;
  return manifest;
}
module.exports = config => {
  config = withAndroidManifest(config, mod => { configureManifest(mod.modResults); return mod; });
  return withDangerousMod(config, ["android", async mod => {
    const directory = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res/xml");
    await fs.mkdir(directory, { recursive: true });
    for (const name of resources) await fs.copyFile(path.join(__dirname, `../assets/android/${name}.xml`), path.join(directory, `${name}.xml`));
    return mod;
  }]);
};
module.exports.configureManifest = configureManifest;
