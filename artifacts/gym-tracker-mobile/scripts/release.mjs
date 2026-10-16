import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function validateRelease(config, release) {
  const version = release?.version;
  if (typeof version !== "string" || !versionPattern.test(version) || !version.split(".").map(Number).every(Number.isSafeInteger)) throw new Error("Invalid release version");
  if (config?.expo?.version !== version) throw new Error("app.json and release.json versions differ");
  if (!Number.isSafeInteger(config.expo.android?.versionCode) || config.expo.android.versionCode < 1) throw new Error("Invalid Android versionCode");
  if (typeof config.expo.runtimeVersion !== "string" || !config.expo.runtimeVersion.trim()) throw new Error("An explicit native runtimeVersion is required for independent OTA releases");
  const date = release.releasedAt;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Invalid release date");
  if (!Array.isArray(release.changes) || release.changes.length < 1 || release.changes.length > 8 || release.changes.some(note => typeof note !== "string" || !note.trim() || note.length > 300)) throw new Error("Provide 1 to 8 nonempty release notes, at most 300 characters each");
  if (new Set(release.changes.map(note => note.trim())).size !== release.changes.length) throw new Error("Duplicate release notes");
}

export async function checkRelease(root = mobileRoot) {
  const config = JSON.parse(await readFile(resolve(root, "app.json"), "utf8"));
  const release = JSON.parse(await readFile(resolve(root, "release.json"), "utf8"));
  validateRelease(config, release);
  return { config, release };
}

export async function bumpRelease({ root = mobileRoot, notes, date = new Date().toISOString().slice(0, 10) }) {
  const { config, release } = await checkRelease(root);
  const parts = release.version.split(".").map(Number);
  parts[2]++;
  config.expo.version = parts.join(".");
  config.expo.android.versionCode++;
  const next = { version: config.expo.version, releasedAt: date, changes: notes };
  validateRelease(config, next);
  const configPath = resolve(root, "app.json");
  const releasePath = resolve(root, "release.json");
  const previousConfig = await readFile(configPath, "utf8");
  const previousRelease = await readFile(releasePath, "utf8");
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
    await writeFile(releasePath, JSON.stringify(next, null, 2) + "\n");
  } catch (error) {
    await writeFile(configPath, previousConfig);
    await writeFile(releasePath, previousRelease);
    throw error;
  }
  return next;
}

async function main() {
  const { values } = parseArgs({ options: {
    check: { type: "boolean" },
    "notes-file": { type: "string" },
    date: { type: "string" },
  } });
  if (values.check) {
    if (values["notes-file"] || values.date) throw new Error("--check cannot be combined with release changes");
    const { config, release } = await checkRelease();
    console.log(`Release ${release.version}, Android ${config.expo.android.versionCode}, native runtime ${config.expo.runtimeVersion}: OK`);
    return;
  }
  if (!values["notes-file"]) throw new Error("Usage: pnpm release:patch --notes-file <JSON array of Russian notes> [--date YYYY-MM-DD]");
  const notes = JSON.parse(await readFile(resolve(values["notes-file"]), "utf8"));
  const next = await bumpRelease({ notes, date: values.date });
  console.log(`Prepared Gym-Beam ${next.version}. Run tests and release:check before publishing.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
