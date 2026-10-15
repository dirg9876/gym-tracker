const fs = require("node:fs");

module.exports = (asset) => {
  const exportPath = asset.httpServerLocation.match(/\?export_path=(.*)/)?.[1];
  if (exportPath) asset = { ...asset, httpServerLocation: exportPath.replace(/\.\.\//g, "_") };
  const resources = JSON.parse(fs.readFileSync(process.env.GYM_APK_RESOURCE_MAP, "utf8"));
  const identifier = (asset.httpServerLocation.replace(/^\//, "") + "/" + asset.name)
    .toLowerCase()
    .replace(/\//g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^(?:assets|assetsunstable_path)_/, "");
  if (resources.includes(identifier)) return asset;

  // pnpm shortens dependency paths on Windows. Match the package-relative tail.
  const location = asset.httpServerLocation.split("/node_modules/").at(-1);
  const suffix = (location + "/" + asset.name)
    .toLowerCase().replace(/\//g, "_").replace(/[^a-z0-9_]/g, "");
  const matches = resources.filter((name) => name.endsWith("_node_modules_" + suffix));
  if (matches.length !== 1) {
    throw new Error(`Native APK resource not found unambiguously: ${identifier}`);
  }
  return { ...asset, httpServerLocation: "/assets", name: matches[0] };
};
