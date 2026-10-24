import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "./equipmentSettings" ? new URL("../lib/equipmentSettings.ts", import.meta.url).href : specifier, context);
} });
const measurement = await import("../lib/workoutMeasurement.ts");
hooks.deregister();
const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = (type, props) => ({ type, props });

// Run the real TSX handlers and filters with native rendering and hooks stubbed.
function loadView(path, { states = [], exercises = [], alerts = [], haptics = [] } = {}) {
  let stateIndex = 0;
  let refIndex = 0;
  const refs = [];
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useEffect: effect => effect(),
      useMemo: calculate => calculate(),
      useRef: value => refs[refIndex++] ??= { current: value },
      useState: initial => [stateIndex < states.length ? states[stateIndex++] : initial, () => {}],
    },
    "react-native": {
      ...Object.fromEntries(["ActivityIndicator", "KeyboardAvoidingView", "Modal", "Pressable", "ScrollView", "Text", "TextInput", "View"].map(name => [name, name])),
      Alert: { alert: (...args) => alerts.push(args) },
      Platform: { OS: "android" },
      StyleSheet: { create: value => value, absoluteFillObject: {} },
    },
    "react-native-gesture-handler": { FlatList: "FlatList", GestureHandlerRootView: "GestureHandlerRootView", ScrollView: "ScrollView" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@expo/vector-icons/Feather": "Feather",
    "expo-haptics": { ImpactFeedbackStyle: { Medium: "medium" }, impactAsync: value => { haptics.push(value); return Promise.resolve(); } },
    "expo-router": { useRouter: () => ({}) },
    "@tanstack/react-query": { useQuery: () => ({ data: [] }), useQueryClient: () => ({}) },
    "@workspace/api-client-react": { useListExercises: () => ({ data: exercises }), useDeleteExercise: () => ({}) },
    "@/hooks/useColors": { useColors: () => ({}) },
    "@/lib/workoutMeasurement": measurement,
    "@/lib/rankHint": { exerciseRankHint: () => null },
    "@/lib/exerciseStandards": {},
    "@/lib/coachApi": {},
  };
  for (const name of ["Button", "MuscleGroupPicker", "EquipmentPicker", "EquipmentSettingsFields", "ExerciseEditor", "ScreenHeader"]) {
    mocks[`@/components/${name}`] = { [name]: name };
  }
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require(specifier) {
    assert.ok(Object.hasOwn(mocks, specifier), `Unexpected UI dependency: ${specifier}`);
    return mocks[specifier];
  } }, { filename: path });
  return Object.fromEntries(Object.entries(module.exports).map(([name, component]) => [name, (...props) => {
    stateIndex = 0;
    refIndex = 0;
    return component(...props);
  }]));
}

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

const exercises = [
  { id: 1, name: "Подъём   гантелей", muscleGroup: "Руки", equipment: "dumbbell" },
  { id: 2, name: "Жим   лёжа", muscleGroup: "Грудь", equipment: "barbell" },
  { id: 3, name: "Сгибание ног", muscleGroup: "Бёдра", equipment: "machine" },
];

for (const screen of ["picker", "catalog"]) test(`${screen} search normalizes case, whitespace and е/ё in names and muscle groups`, () => {
  for (const [search, expected] of [
    ["  ПОДЪЕМ \t ГАНТЕЛЕЙ  ", [1]],
    ["жим \n лежа", [2]],
    ["ЖИМ ЛЁЖА", [2]],
    ["   БЕДРА ", [3]],
    [" грудь ", [2]],
    ["\t\n \u00a0", [1, 2, 3]],
    ["несуществующее", []],
  ]) {
    let ids;
    if (screen === "picker") {
      const { ExercisePicker } = loadView("../components/ExercisePicker.tsx", { states: [true, search] });
      const tree = ExercisePicker({ exercises, onSelect() {} });
      const list = nodes(tree, node => node.type === "FlatList")[0];
      ids = Array.from(list.props.data.filter(row => row.type === "item"), row => row.ex.id);
    } else {
      const { ExerciseLibrary } = loadView("../components/ExerciseLibrary.tsx", { states: [search], exercises });
      const names = nodes(ExerciseLibrary({ embedded: true }), node => node.type === "Text").map(node => node.props.children);
      ids = exercises.filter(exercise => names.includes(exercise.name)).map(exercise => exercise.id);
    }
    assert.deepEqual(ids, expected, search);
  }
});

const recorded = { id: 1, exerciseId: 2, exerciseName: "Жим лёжа", weightKg: 40, reps: 8 };
function renderSet({ set = recorded, disabled = false, onDelete = () => {} } = {}) {
  const alerts = [], haptics = [];
  const { SetCard } = loadView("../components/SetCard.tsx", { alerts, haptics });
  const tree = SetCard({ set, index: 2, disabled, onDelete });
  const button = nodes(tree, node => node.type === "Pressable")[0];
  return { button, alerts, haptics };
}

test("set deletion waits for a named destructive confirmation; cancellation does nothing", () => {
  let deleted = 0;
  const { button, alerts, haptics } = renderSet({ onDelete: () => deleted++ });
  assert.ok(button.props.accessibilityLabel.includes(recorded.exerciseName));
  assert.ok(button.props.accessibilityLabel.includes(measurement.formatSetResult(recorded)));
  button.props.onPress();
  assert.equal(deleted, 0);
  assert.equal(haptics.length, 0);
  const [title, message, actions] = alerts[0];
  assert.equal(title, "Удалить подход?");
  assert.ok(message.includes(recorded.exerciseName));
  assert.ok(message.includes("Подход 2"));
  assert.ok(message.includes(measurement.formatSetResult(recorded)));
  const cancel = actions.find(action => action.style === "cancel");
  assert.ok(cancel);
  cancel.onPress?.();
  assert.equal(deleted, 0);
  assert.equal(haptics.length, 0);
  button.props.onPress();
  alerts[1][2].find(action => action.style === "destructive").onPress();
  assert.equal(deleted, 1);
  assert.equal(haptics.length, 1);
});

test("a pending parent disables set deletion and its accessibility state", () => {
  let deleted = 0;
  const { button, alerts, haptics } = renderSet({ disabled: true, onDelete: () => deleted++ });
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.accessibilityState.disabled, true);
  button.props.onPress();
  assert.equal(alerts.length, 0);
  assert.equal(deleted, 0);
  assert.equal(haptics.length, 0);
});

test("a confirmation opened before the parent became pending cannot call a stale deletion", () => {
  let deleted = 0;
  const alerts = [];
  const { SetCard } = loadView("../components/SetCard.tsx", { alerts });
  const props = { set: recorded, index: 1, onDelete: () => deleted++ };
  const tree = SetCard(props);
  nodes(tree, node => node.type === "Pressable")[0].props.onPress();
  SetCard({ ...props, disabled: true });
  alerts[0][2].find(action => action.style === "destructive").onPress();
  assert.equal(deleted, 0);
});

test("confirmation uses recorded units for timed, bodyweight, assisted and paired-dumbbell sets", () => {
  for (const set of [
    { ...recorded, exerciseName: "Планка", weightKg: 0, reps: 0, durationSeconds: 45 },
    { ...recorded, exerciseName: "Отжимания", weightKg: 0, reps: 12 },
    { ...recorded, exerciseName: "Подтягивания", loadMode: "assisted" },
    { ...recorded, exerciseName: "Подъём гантелей", dumbbellCount: 2 },
  ]) {
    const { button, alerts } = renderSet({ set });
    button.props.onPress();
    assert.ok(alerts[0][1].includes(set.exerciseName));
    assert.ok(alerts[0][1].includes(measurement.formatSetResult(set)));
  }
});
