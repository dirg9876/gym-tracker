const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Local APK smoke tests reuse the native resources of an existing build.
if (process.env.GYM_APK_RESOURCE_MAP) {
  config.transformer.assetPlugins.push(require.resolve("./scripts/native-asset-plugin.cjs"));
}

module.exports = config;
