const fs = require("node:fs/promises");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const resourceName = "gymbeam_coach_network_security";

function configureManifest(manifest) {
  manifest.manifest.application[0].$["android:networkSecurityConfig"] = `@xml/${resourceName}`;
  return manifest;
}
function withCoachNetworkSecurity(config) {
  config = withAndroidManifest(config, config => { configureManifest(config.modResults); return config; });
  return withDangerousMod(config, ["android", async config => {
    const directory = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/xml");
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(path.join(__dirname, `../assets/android/${resourceName}.xml`), path.join(directory, `${resourceName}.xml`));
    return config;
  }]);
}
module.exports = withCoachNetworkSecurity;
module.exports.configureManifest = configureManifest;
module.exports.resourceName = resourceName;
