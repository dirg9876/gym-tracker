import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
const ts = createRequire(import.meta.url)("typescript");
const jsx = (type, props) => ({ type, props });
const native = { View: "View", Text: "Text", Pressable: "Pressable" };
const base = {
  "react/jsx-runtime": { jsx, jsxs: jsx }, react: { useState: value => [value, () => {}] },
  "react-native": native, "@expo/vector-icons/Feather": "Feather",
  "@/hooks/useColors": { useColors: () => ({}) }, "./LineChart": { LineChart: "LineChart" },
  "@/lib/format": { formatKg: n => `${n} кг`, formatNumber: String, formatDate: d => d, formatShortDate: d => d.slice(0, 10) },
};
function render(overrides) {
  const source = readFileSync(new URL("../components/ExerciseOutlook.tsx", import.meta.url), "utf8");
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) { assert.ok(Object.hasOwn(base, name), `Unexpected UI dependency: ${name}`); return base[name]; } });
  const outlook = { exercise: { equipment: "barbell" }, repsMin: 8, repsMax: 12, targetRir: 2, scenarioRir: 4, calibration: false, initialWeightKg: 55,
    scheduleSource: "Сплит", changeKg: 0, sessions: [], progression: null, assumptions: "Условный сценарий", reason: "Опора: 60 кг × 8, запас 0. Цель — запас 2: 55 кг × 8.",
    lastPerformance: { date: "2026-10-27T10:00:00Z", weightKg: 60, reps: 8, rir: 0, durationSeconds: null }, ...overrides };
  return module.exports.ExerciseOutlook({ outlook, compact: true });
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
test("compact outlook exposes both the achieved set and the RIR reason for a lower target without expanding details", () => {
  const value = text(render());
  assert.match(value, /Последний результат · 2026-10-27: 60 кг × 8 · запас 0/);
  assert.match(value, /Цель — запас 2: 55 кг × 8/);
});
test("a missing assessment is not displayed as zero reserve", () => {
  const value = text(render({ lastPerformance: { date: "2026-10-27", weightKg: 60, reps: 8, rir: null }, initialWeightKg: 60 }));
  assert.match(value, /запас не указан/); assert.doesNotMatch(value, /запас 0/);
});
test("timed and assisted reference labels keep their real units and load semantics", () => {
  assert.match(text(render({ timed: true, lastPerformance: { date: "2026-10-27", durationSeconds: 40 } })), /2026-10-27: 40 с/);
  assert.match(text(render({ assisted: true })), /противовес 60 кг × 8/);
});
