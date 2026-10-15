import { createCoachGateway } from "../src/coach/app.ts";
import { CoachLedger } from "../src/coach/ledger.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

// Test-only provider: never imports credentials or makes upstream calls.
const directory = new URL("../.coach-data/native-qa/", import.meta.url);
mkdirSync(directory, { recursive: true });
const token = randomBytes(32).toString("base64url");
writeFileSync(new URL("owner-token", directory), token, { mode: 0o600 });
writeFileSync(new URL("gym-beam-coach-connection.json", directory), JSON.stringify({ format: "gym-beam-coach-connection", version: 1, url: "http://127.0.0.1:8787", token }), { mode: 0o600 });
const ledger = new CoachLedger(":memory:");
const provider = async context => {
  console.log(JSON.stringify({ task: context.task, sets: context.sessions.reduce((n, session) => n + session.sets.length, 0) }));
  const base = { summary: "Тестовый ответ: OpenAI не вызывался.", cautions: [], nextSet: null, plan: null };
  if (context.task === "month_plan") {
    base.monthly = { name: "AI QA month", overview: "Тестовый план на четыре недели, без обращения к OpenAI.", daysPerWeek: context.preferences.daysPerWeek, templates: [{ name: "AI QA session", description: "Test only", exercises: [{ exerciseId: 30, reason: "Проверка сохранения месячного плана.", targets: [{ weightKg: 0, reps: 0, durationSeconds: 30 }] }] }], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Без автоматического повышения нагрузки.", sessions: Array.from({ length: context.preferences.daysPerWeek }, () => 0) })) };
  }
  if (context.task === "next_set" && context.focus?.draft) {
    const draft = context.focus.draft;
    base.nextSet = { exerciseId: draft.exerciseId, weightKg: draft.weightKg, reps: draft.durationSeconds == null ? draft.reps + 1 : 0, durationSeconds: draft.durationSeconds, reason: "Проверка применения только к черновику." };
  }
  if (context.task === "next_workout" || context.task === "adjust_workout") {
    const wanted = (context.scheduled ? context.scheduled.plan.exercises.map(ex => ex.exerciseId) : context.trainingMode === "office" ? [7, 4, 30] : [1, 3, 30]).filter(id => context.catalog.some(ex => ex.id === id && context.preferences.equipment.includes(ex.equipment) && !context.preferences.excludedExerciseIds.includes(id)));
    base.plan = { name: "AI QA plan", description: "Test provider, not live AI", exercises: wanted.map(exerciseId => {
      const ex = context.catalog.find(ex => ex.id === exerciseId);
      const last = context.sessions.flatMap(s => s.sets).filter(s => s.exerciseId === exerciseId).at(-1);
      return { exerciseId, reason: "Тестовый редактируемый план.", targets: Array.from({ length: 2 }, () => ({ weightKg: ex.timed || context.trainingMode === "office" ? 0 : last?.weightKg ?? null, reps: ex.timed ? 0 : context.trainingMode === "office" ? 3 : 8, durationSeconds: ex.timed ? 30 : null })) };
    }) };
  }
  return { text: JSON.stringify(base), inputTokens: 512, outputTokens: 250, completed: true };
};
const app = createCoachGateway({ token, ledger, provider });
const server = app.listen(8787, "127.0.0.1", () => console.log("QA-only gateway ready on 8787; no OpenAI calls"));
const stop = () => server.close(() => { ledger.close(); process.exit(0); });
process.on("SIGTERM", stop); process.on("SIGINT", stop);
