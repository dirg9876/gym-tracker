import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
const ts = createRequire(import.meta.url)("typescript");
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const jsx = (type, props) => ({ type, props });
const settle = () => new Promise(resolve => setImmediate(resolve));
const base = { "react/jsx-runtime": { jsx, jsxs: jsx }, "@/hooks/useColors": { useColors: () => ({}) } };
function load(path, mocks) {
  const module = { exports: {} }, text = ts.transpileModule(source(path), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(text, { module, exports: module.exports, process: { env: {} }, require(name) { assert.ok(Object.hasOwn(mocks, name), `Unexpected UI dependency: ${name}`); return mocks[name]; } });
  return module.exports;
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function animation({ reduced = false, fresh = true, claim = true, assetReady = true } = {}) {
  const effects = [], values = [], timings = [];
  let claims = 0, starts = 0, stops = 0, removed = 0, changed;
  class Value { setValue(value) { values.push(value); } interpolate(value) { return value; } }
  const component = load("components/WorkoutCelebration.tsx", { ...base,
    react: { useEffect: effect => effects.push(effect), useRef: value => ({ current: value }) },
    "expo-asset": { useAssets: () => [assetReady ? [{ localUri: "file:///cup.png" }] : undefined] }, "expo-image": { Image: "Image" }, "@/assets/images/gymbeam-logo.png": 1,
    "@/lib/workoutCelebration": { claimWorkoutCelebration: async () => { claims++; return claim; } },
    "react-native": { View: "View", Animated: { Value, View: "AnimatedView", timing: (value, options) => { timings.push(options); return { start() { starts++; }, stop() { stops++; } }; } }, Easing: { cubic: "cubic", out: value => value },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: (name, listener) => { assert.equal(name, "reduceMotionChanged"); changed = listener; return { remove() { removed++; } }; } } },
  }).WorkoutCelebration;
  const tree = component({ workoutId: 4, finishedAt: "2026-10-25T09:00:00Z", fresh });
  const cleanup = effects[0]();
  return { tree, values, timings, cleanup, toggle: value => changed(value), stats: () => ({ claims, starts, stops, removed }) };
}
test("fresh finish animates the actual cup/particle TSX with native transforms, a short finite duration and no interaction overlay", async () => {
  const view = animation(); await settle();
  assert.equal(view.stats().starts, 1); assert.equal(view.timings[0].duration, 1150); assert.equal(view.timings[0].useNativeDriver, true);
  assert.equal(view.tree.props.pointerEvents, "none"); assert.equal(nodes(view.tree, n => n.type === "Image")[0].props.source.uri, "file:///cup.png");
  assert.equal(nodes(view.tree, n => n.type === "AnimatedView").length, 15);
  view.cleanup(); assert.equal(view.stats().stops, 1); assert.equal(view.stats().removed, 1);
});
for (const options of [{ reduced: true }, { fresh: false }, { claim: false }, { assetReady: false }]) test(`celebration stays static when animation is not appropriate (${JSON.stringify(options)})`, async () => {
  const view = animation(options); await settle(); assert.equal(view.stats().starts, 0); assert.equal(view.values.includes(0), false); view.cleanup();
});
test("turning on reduced motion stops a running animation immediately and settles it", async () => {
  const view = animation(); await settle(); view.toggle(true);
  assert.equal(view.stats().stops, 1); assert.equal(view.values.at(-1), 1); view.cleanup();
});
test("leaving before asynchronous permission/claim resolves never animates or claims", async () => {
  const view = animation(); view.cleanup(); await settle(); assert.equal(view.stats().starts, 0); assert.equal(view.stats().claims, 0);
});
function backup({ result = { kind: "needs-folder" }, next = result, cancel = false } = {}) {
  const effects = [], calls = [], updates = []; let index = 0;
  const component = load("components/AutomaticWorkoutBackup.tsx", { ...base,
    react: { useEffect: effect => effects.push(effect), useRef: value => ({ current: value }), useState: () => [index++ === 0 ? result : false, value => updates.push(value)] },
    "@expo/vector-icons/Feather": "Feather", "react-native": { ActivityIndicator: "ActivityIndicator", Text: "Text", View: "View" }, "./Button": { Button: "Button" },
    "expo-router": { useRouter: () => ({ push: route => calls.push(route) }) }, "@/lib/format": { formatDate: value => value },
    "@/lib/automaticBackup": { chooseAutomaticBackupFolder: async () => { calls.push("folder"); if (cancel) throw new Error("canceled"); }, runAutomaticBackup: async force => { calls.push(force ? "forced" : "automatic"); return next; }, getAutomaticBackupSettings: async () => ({ lastExport: null }) },
  }).AutomaticWorkoutBackup;
  return { tree: component(), effects, calls, updates };
}
test("automatic backup remains automatic but does not show an alert or open a picker by itself", async () => {
  const view = backup(); view.effects[0](); await settle(); assert.deepEqual(view.calls, ["automatic"]);
  assert.doesNotMatch(source("components/AutomaticWorkoutBackup.tsx"), /Alert|Modal/);
});
test("choosing a backup folder is explicit, then forces a verified copy; cancellation is not a failure", async () => {
  const view = backup({ next: { kind: "saved", filename: "copy.json" } });
  nodes(view.tree, n => n.type === "Button")[0].props.onPress(); await settle();
  assert.deepEqual(view.calls, ["folder", "forced"]); assert.ok(view.updates.some(value => value?.kind === "saved"));
  const canceled = backup({ cancel: true }); nodes(canceled.tree, n => n.type === "Button")[0].props.onPress(); await settle();
  assert.deepEqual(canceled.calls, ["folder"]); assert.equal(canceled.updates.some(value => value?.kind === "failed"), false);
});
test("recap owns one meaningful summary, loads saved facts after restart, and defers detail/AI requests", () => {
  const report = source("app/workout/[id]/report.tsx"), finish = source("app/workout/[id]/index.tsx");
  assert.match(report, /\/recap`/); assert.doesNotMatch(report, /finish-report|newPersonalRecords|PRBadge/);
  assert.match(report, /w.totalSets > 0 \? <WorkoutCelebration/); assert.match(finish, /report\?celebrate=1/);
  assert.match(report, /\{details \?/); assert.match(report, /\{ai \? <AiCoachPanel task="review"/); assert.doesNotMatch(report, /task="next_workout"/);
  assert.match(report, /status === 409/); assert.match(report, /status === 404/); assert.match(report, /useFocusEffect/);
  assert.match(report, /backgroundColor: colors.background, paddingTop: insets.top/); assert.doesNotMatch(report, /paddingTop: insets.top \+ 12/);
  const template = source("components/SaveWorkoutTemplate.tsx");
  assert.match(template, /GestureHandlerRootView/); assert.match(template, /Platform.OS === "ios" \? "padding" : undefined/);
});
