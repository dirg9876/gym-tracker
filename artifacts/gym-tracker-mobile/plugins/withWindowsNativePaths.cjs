const { withProjectBuildGradle, withAppBuildGradle } = require("expo/config-plugins");
module.exports = config => {
config = withProjectBuildGradle(config, mod => {
  const marker = 'apply from: file("../scripts/windows-native-paths.gradle")';
  if (!mod.modResults.contents.includes(marker)) {
    mod.modResults.contents = mod.modResults.contents.replace('apply plugin: "expo-root-project"', `if (System.getProperty("os.name").toLowerCase().contains("windows")) {\n  ${marker}\n}\n\napply plugin: "expo-root-project"`);
  }
  return mod;
});
return withAppBuildGradle(config, mod => {
  const marker = 'extraPackagerArgs = ["--entry-file", entryFile.get().asFile.absolutePath]';
  if (!mod.modResults.contents.includes(marker)) {
    mod.modResults.contents = mod.modResults.contents.replace("    autolinkLibrariesWithApp()", `    ${marker}\n    autolinkLibrariesWithApp()`);
  }
  return mod;
});
};
