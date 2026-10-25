import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test, beforeEach } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { planExerciseLines } = await import("../lib/planSummary.ts");
const equipment = await import("../lib/equipmentSettings.ts");
const format = await import("../lib/format.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const ts = createRequire(import.meta.url)("typescript");
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const jsx = (type, props) => ({ type, props });
const settle = () => new Promise(resolve => setImmediate(resolve));
const exercise = { id: 1, name: "Жим штанги лёжа", muscleGroup: "Грудь", equipment: "barbell", weightStepKg: 2.5 };
const definition = (changes = {}) => ({ exerciseId: 1, name: exercise.name, equipment: "barbell", sets: 3, repsMin: 8, repsMax: 12, suggestedWeightKg: 50, ...changes });
const target = (weightKg, reps) => ({ weightKg, reps });
beforeEach(() => { storage.clear(); globalThis.__storageFault = undefined; });

function load(path, mocks) {
  const module = { exports: {} };
  const text = ts.transpileModule(source(path), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(text, { module, exports: module.exports, require(name) { assert.ok(Object.hasOwn(mocks, name), `Unexpected UI dependency: ${name}`); return mocks[name]; } });
  return module.exports;
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const uiMocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx }, "@expo/vector-icons/Feather": "Feather",
  "react-native": Object.fromEntries(["Pressable", "Text", "View", "ActivityIndicator", "RefreshControl", "ScrollView"].map(name => [name, name])),
  "@/hooks/useColors": { useColors: () => ({}) }, "./Button": { Button: "Button" }, "./Stepper": { Stepper: "Stepper" },
};
function stepView({ draft = 5, disabled = false, send = request } = {}) {
  const calls = [], pending = [], notifications = [], updates = [];
  let invalidations = 0, saved = 0, index = 0;
  const component = load("components/ExerciseWeightStep.tsx", { ...uiMocks,
    react: { useState: () => [index++ === 0 ? draft : false, value => updates.push(value)], useRef: value => ({ current: value }) },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries: async () => { invalidations++; } }), useMutation: options => ({ mutateAsync: options.mutationFn, reset() {} }) },
    "./Toast": { useToast: () => ({ show: (...args) => notifications.push(args) }) },
    "@/lib/coachApi": { coachRequest: (...args) => { calls.push(args); return send(...args); } }, "@/lib/equipmentSettings": equipment,
  }).ExerciseWeightStep;
  const tree = component({ exercise, disabled, onPendingChange: value => pending.push(value), onSaved: () => saved++ });
  return { tree, calls, pending, notifications, updates, saved: () => saved, invalidations: () => invalidations,
    save: () => nodes(tree, n => n.type === "Button")[0].props.onPress() };
}

test("quick step's real TSX save handler patches only this exercise, invalidates data, unlocks and closes after success", async () => {
  await request("/api/exercises"); const view = stepView();
  view.save(); await settle(); await settle();
  assert.equal(view.calls.length, 1); assert.deepEqual(Array.from(view.calls[0]).slice(0, 2), ["/api/exercises/1", "PATCH"]);
  assert.equal(view.calls[0][2].weightStepKg, 5); assert.equal(Object.keys(view.calls[0][2]).length, 1);
  assert.equal((await request("/api/exercises")).find(ex => ex.id === 1).weightStepKg, 5);
  assert.deepEqual(view.pending, [true, false]); assert.equal(view.invalidations(), 1); assert.equal(view.saved(), 1);
});
test("rapid double save shares the synchronous lock and writes once", async () => {
  let resolve; const gate = new Promise(done => { resolve = done; });
  const view = stepView({ send: async () => { await gate; } });
  view.save(); view.save(); assert.equal(view.calls.length, 1); assert.deepEqual(view.pending, [true]);
  resolve(); await settle(); assert.equal(view.saved(), 1); assert.deepEqual(view.pending, [true, false]);
});
test("failed save keeps the editor open, releases its lock and can be retried", async () => {
  let failed = false;
  const view = stepView({ send: async () => { if (!failed) { failed = true; throw new Error("Storage unavailable"); } } });
  view.save(); await settle(); assert.equal(view.saved(), 0); assert.equal(view.notifications[0][0], "error");
  assert.deepEqual(view.pending, [true, false]); view.save(); await settle(); assert.equal(view.saved(), 1);
});
for (const options of [{ disabled: true }, { draft: 2.5 }]) test(`blocked or unchanged quick step never writes (${JSON.stringify(options)})`, async () => {
  const view = stepView(options); const button = nodes(view.tree, n => n.type === "Button")[0];
  if (button) view.save(); await settle(); assert.equal(view.calls.length, 0); assert.equal(view.saved(), 0);
});
test("cancel only discards a pending step and does not touch progress", () => {
  const view = stepView(); nodes(view.tree, n => n.props.accessibilityLabel === "Отменить изменение шага")[0].props.onPress();
  assert.equal(view.updates.at(-1), null); assert.equal(view.calls.length, 0);
});

test("plan summary groups only consecutive equal targets and retains the ordered back-off prescription", () => {
  assert.deepEqual(planExerciseLines(definition({ setTargets: [target(55, 8), target(55, 8), target(55, 8)] })), ["3 подх. · 55 кг × 8"]);
  assert.deepEqual(planExerciseLines(definition({ setTargets: [target(55, 8), target(50, 10), target(55, 8)] })), ["1 подх. · 55 кг × 8", "1 подх. · 50 кг × 10", "1 подх. · 55 кг × 8"]);
});
test("plan summary never labels seconds as kilograms or hides zero-added-weight bodyweight", () => {
  assert.deepEqual(planExerciseLines(definition({ sets: 1, equipment: "bodyweight", setTargets: [{ weightKg: 0, reps: 0, durationSeconds: 45 }] })), ["1 подх. · 45 с"]);
  assert.deepEqual(planExerciseLines(definition({ sets: 1, equipment: "bodyweight", setTargets: [target(0, 8)] })), ["1 подх. · свой вес × 8"]);
  assert.deepEqual(planExerciseLines(definition({ sets: 1, equipment: "bodyweight", setTargets: [target(5, 8)] })), ["1 подх. · +5 кг × 8"]);
});
test("plan summary distinguishes counterweight from external load and always labels dumbbells per implement", () => {
  assert.deepEqual(planExerciseLines(definition({ sets: 1, equipment: "machine", setTargets: [target(30, 8)] }), { loadMode: "assisted" }), ["1 подх. · противовес 30 кг × 8"]);
  assert.deepEqual(planExerciseLines(definition({ sets: 1, equipment: "dumbbell", setTargets: [target(12.5, 10)] }), { dumbbellCount: 2 }), ["1 подх. · 12,5 кг на гантель × 10"]);
});

function overview({ active = { data: { workout: null }, isSuccess: true }, focused = true, preview = {}, month = {} } = {}) {
  const queries = [], routes = [];
  const component = load("components/TrainingPlanOverview.tsx", { ...uiMocks,
    react: { useState: () => [focused, () => {}], useCallback: fn => fn },
    "expo-router": { useFocusEffect() {}, useRouter: () => ({ push: path => routes.push(path) }) },
    "@tanstack/react-query": { useQuery: options => { queries.push(options); return options.queryKey[0] === "daily-workout" ? preview : month; } },
    "@workspace/api-client-react": { getGetActiveWorkoutQueryKey: () => ["active"], getListExercisesQueryKey: () => ["exercises"], useGetActiveWorkout: options => { queries.push(options.query); return active; }, useListExercises: options => { queries.push(options.query); return { data: [exercise] }; } },
    "@/lib/coachApi": { coachRequest: request }, "@/lib/format": format, "@/lib/planSummary": { planExerciseLines },
  }).TrainingPlanOverview;
  return { tree: component(), queries, routes };
}
test("overview disables next-plan computation while a workout exists, active status is unknown, or screen is unfocused", () => {
  for (const options of [{ active: { data: { workout: { id: 4, name: "Current", totalSets: 1, sets: [{ exerciseId: 1 }] } }, isSuccess: true } }, { active: { isError: true, isSuccess: false } }, { focused: false }]) {
    const view = overview(options), daily = view.queries.find(q => q.queryKey[0] === "daily-workout");
    assert.equal(daily.enabled, false);
  }
});
test("overview opens the existing workout instead of creating a second session", () => {
  const view = overview({ active: { data: { workout: { id: 4, name: "Current", totalSets: 2, sets: [{ exerciseId: 1 }, { exerciseId: 1 }] } }, isSuccess: true } });
  nodes(view.tree, n => n.type === "Button")[0].props.onPress(); assert.deepEqual(view.routes, ["/workout/4"]);
});
test("plan rows open combined exercise progress, while month remains readable without the AI session", () => {
  const view = overview({ preview: { data: { date: "2026-10-25", plan: { name: "Next", exercises: [definition()] } } } });
  nodes(view.tree, n => n.props.accessibilityLabel === exercise.name + ", история и прогноз")[0].props.onPress();
  nodes(view.tree, n => n.props.accessibilityLabel === "Месячный план")[0].props.onPress();
  assert.deepEqual(view.routes, ["/exercises/1?view=progress", "/coach-month"]);
  assert.equal(view.queries.find(q => q.queryKey[0] === "daily-workout").enabled, true);
});
test("opening overview data is read-only and still works with no AI credentials", async () => {
  await request("/api/exercises"); const before = new Map(storage);
  const active = await request("/api/workouts/active"), preview = await request("/api/daily-workout"), month = await request("/api/ai-coach/month");
  assert.equal(active.workout, null); assert.ok(preview.plan); assert.equal(month, null); assert.deepEqual(storage, before);
  assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).workouts.length, 0);
});
test("changing step mid-workout preserves recorded sets, a manual load, assessment positions and paused timer", async () => {
  const workout = await request("/api/workouts", "POST"), url = `/api/workouts/${workout.id}/draft`;
  let draft = await request(url);
  draft = await request(url, "PUT", { revision: draft.revision, draft: { exerciseId: 1, weightKg: 50, reps: 10, rir: 2, technique: "good" } });
  await request(url + "/commit", "POST", { revision: draft.revision });
  draft = await request(url);
  draft = await request(url, "PUT", { revision: draft.revision, draft: { ...draft.draft, weightKg: 47.5 }, assessment: { rir: true, technique: true } });
  const timer = { kind: "rest", totalMs: 120000, remainingMs: 90000, endsAt: null };
  await request(`/api/workouts/${workout.id}/timer`, "PUT", timer);
  const sets = JSON.parse(storage.get(PROGRESS_KEY)).sets;
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  const fresh = await request(url), state = JSON.parse(storage.get(PROGRESS_KEY));
  assert.deepEqual(state.sets, sets); assert.deepEqual(state.workouts[0].timer, timer);
  assert.deepEqual(fresh.draft, draft.draft); assert.equal(fresh.revision, draft.revision + 1);
  assert.deepEqual(fresh.assessment, { rir: false, technique: false });
});
test("navigation keeps five tabs and one Home start action; templates and plans are lazy and preview has no AI/start side effects", () => {
  const screen = source("app/workout/[id]/index.tsx"), control = source("components/ExerciseWeightStep.tsx"), plan = source("components/TrainingPlanOverview.tsx"), tabs = source("app/(tabs)/programs.tsx");
  assert.match(screen, /selectedExercise && !timed \?/); assert.match(screen, /accessibilityLabel="Изменить шаг веса"/);
  assert.match(screen, /\|\| stepSaving/); assert.match(control, /lock.current \|\| disabled/);
  assert.match(control, /disabled=\{busy \|\| disabled\}/); assert.doesNotMatch(control, /TextInput/);
  assert.match(tabs, /enabled: view === "templates"/); assert.match(tabs, /value: "plan", label: "План"/);
  assert.doesNotMatch(plan, /useAiCoach|\.ask\(|"POST"|\/start-workout|Начать тренировку/);
  assert.match(source("app/coach-month.tsx"), /router.push\("\/start-workout" as Href\)/);
  assert.equal((source("app/(tabs)/_layout.tsx").match(/<Tabs.Screen/g) ?? []).length, 5);
});
