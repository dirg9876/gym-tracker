import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const text = file => readFileSync(new URL(file, root), "utf8");
const docs = [
  "README.md",
  "AI_COACH_GUIDE.md",
  "AI_COACH_PLAN.md",
  "AGENTS.md",
  "CHECKPOINT.md",
  "artifacts/api-server/COACH_SETUP.md",
  "artifacts/api-server/PHONE_SETUP.md",
  "artifacts/ai-coach-worker/README.md",
  "artifacts/gym-tracker-mobile/UPDATES.md",
];

test("current repository guides use Gym-Beam branding and no retired hosting descriptions", () => {
  for (const file of docs) {
    const source = text(file);
    assert.match(source.split(/\r?\n/, 1)[0], /Gym-Beam/, file);
    assert.doesNotMatch(source, /replit|repl\.(?:co|it)|Gym[ _]+Tracker|GymTracker/i, file);
    assert.doesNotMatch(source, /PostgreSQL|Clerk|artifacts\/gym-tracker\/src|mockup-sandbox/, file);
  }
});

test("active coach instructions do not recommend obsolete test APKs or a second home start button", () => {
  for (const file of docs) {
    assert.doesNotMatch(text(file), /gym-beam-(?:autoconnect|ai-coach)\.apk|gym-tracker-tested\.apk|versionCode\s*5\b|Начать тренировку с ИИ/, file);
  }
  assert.match(text("AI_COACH_GUIDE.md"), /автоматически на этом экране/);
  assert.match(text("artifacts/api-server/PHONE_SETUP.md"), /«Начать самостоятельно»|начать самостоятельно/);
});

test("local Markdown links in current guides resolve to repository files", () => {
  for (const file of docs) {
    for (const match of text(file).matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z\d+.-]*:|^#/i.test(target)) continue;
      assert.ok(existsSync(new URL(target.split("#", 1)[0], new URL(file, root))), `${file}: ${target}`);
    }
  }
});

test("public branding preserves installed Android, update and backup identities", () => {
  assert.match(JSON.parse(text("package.json")).description, /^Gym-Beam:/);
  const app = JSON.parse(text("artifacts/gym-tracker-mobile/app.json")).expo;
  assert.equal(app.name, "Gym-Beam");
  assert.equal(app.slug, "gym-tracker-mobile");
  assert.equal(app.scheme, "gym-tracker-mobile");
  assert.equal(app.android.package, "com.dirg9876.gymtracker");
  assert.equal(app.extra.eas.projectId, "dabd3128-415f-4a2f-8c73-3b0a52585149");
  assert.match(text("artifacts/gym-tracker-mobile/lib/progressBackup.ts"), /z\.literal\("gym-tracker-backup"\)/);
  assert.match(text("artifacts/gym-tracker-mobile/lib/progressStorage.ts"), /"gym-tracker:offline-api:v1"/);
  assert.match(text("artifacts/gym-tracker-mobile/lib/aiCoachConnection.ts"), /"gym-tracker:ai-connection:v1"/);
});
