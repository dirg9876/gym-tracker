import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function normalizeAndroidPackage(pkg, platforms) {
  if (platforms?.length !== 1 || platforms[0] !== "android") return pkg;
  const scripts = { ...pkg.scripts };
  // Expo prebuild inserts these defaults even with --platform android.
  if (["expo run:ios", "expo start --ios"].includes(scripts.ios)) delete scripts.ios;
  if (scripts.web === "expo start --web") delete scripts.web;
  return { ...pkg, scripts };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const config = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
  const file = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(await readFile(file, "utf8"));
  const normalized = normalizeAndroidPackage(pkg, config.expo.platforms);
  if (JSON.stringify(normalized) !== JSON.stringify(pkg)) await writeFile(file, JSON.stringify(normalized, null, 2) + "\n");
}
