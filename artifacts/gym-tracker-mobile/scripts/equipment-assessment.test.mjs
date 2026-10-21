import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import { request, storage } from "./testHarness.mjs";
const { makeWorkoutDraft, selectWorkoutDraft } = await import("../lib/workoutDraft.ts");
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { formatSetResult, formatSetContext } = await import("../lib/workoutMeasurement.ts");
const { weightStep, weightPresets } = await import("../lib/equipmentSettings.ts");
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
import { validateCoachReply } from "@workspace/ai-coach";

beforeEach(() => storage.clear());
const start = () => request("/api/workouts", "POST", {});
const create = settings => request("/api/exercises", "POST", { name: "Equipment fixture", muscleGroup: "Спина", equipment: "machine", ...settings });
const add = (id, exerciseId, weightKg, reps, extra={}) => request(`/api/workouts/${id}/sets`, "POST", { exerciseId, weightKg, reps, ...extra });
const finish = id => request(`/api/workouts/${id}/finish`, "POST");
async function save(id, draft) { const path=`/api/workouts/${id}/draft`; const current=await request(path); return request(path,"PUT",{revision:current.revision,draft}); }
const commit = (id,revision) => request(`/api/workouts/${id}/draft/commit`,"POST",{revision});

test("zero reserve and broken technique persist, can be changed or explicitly cleared, and survive import", async () => {
  const workout=await start();
  const first=await save(workout.id,{exerciseId:1,weightKg:20,reps:8,rir:0,technique:"breakdown"});
  const next=await commit(workout.id,first.revision);
  assert.equal(next.draft.rir,0); assert.equal(next.draft.technique,"breakdown");
  await restoreProgress(await exportProgress());
  assert.deepEqual((await request(`/api/workouts/${workout.id}/draft`)).draft,next.draft);
  const changed=await save(workout.id,{...next.draft,rir:3,technique:"good"});
  const again=await commit(workout.id,changed.revision);
  assert.equal(again.draft.rir,3); assert.equal(again.set.rir,3);
  const cleared=await save(workout.id,{...again.draft,rir:null,technique:null});
  const last=await commit(workout.id,cleared.revision);
  assert.equal(last.draft.rir,null); assert.equal(last.set.technique,null);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets[0].rir,0);
});

test("automatic plan transitions restore the next exercise's own prior ratings, not the previous exercise's ratings", async () => {
  const program=await request("/api/programs","POST",{name:"Transition fixture",exercises:[
    {exerciseId:1,sets:1,repsMin:8,repsMax:8,intent:"hypertrophy",setTargets:[{weightKg:20,reps:8}]},
    {exerciseId:3,sets:2,repsMin:8,repsMax:8,intent:"hypertrophy",setTargets:[{weightKg:10,reps:8},{weightKg:12.5,reps:8}]},
  ]});
  const workout=await request("/api/workouts","POST",{programId:program.id});
  let draft=await save(workout.id,{exerciseId:3,weightKg:10,reps:8,rir:3,technique:"good"});
  await commit(workout.id,draft.revision);
  draft=await save(workout.id,{exerciseId:1,weightKg:20,reps:8,rir:0,technique:"breakdown"});
  const next=await commit(workout.id,draft.revision);
  assert.equal(next.draft.exerciseId,3); assert.equal(next.draft.weightKg,12.5);
  assert.equal(next.draft.rir,3); assert.equal(next.draft.technique,"good");
});

test("assessment inheritance respects exercise units and never invents defaults for a new exercise", () => {
  const bench={id:1,name:"Жим штанги лёжа",equipment:"barbell"};
  assert.equal(makeWorkoutDraft(bench,undefined,{rir:0,technique:"good"}).rir,0);
  assert.equal(makeWorkoutDraft(bench).rir,null);
  assert.deepEqual(makeWorkoutDraft({id:30,name:"Планка",equipment:"bodyweight"},undefined,{rir:4,technique:"good"}),{exerciseId:30,weightKg:0,reps:0,durationSeconds:30,rir:null,technique:"good"});
});

test("exercise reselection preserves the draft; returning restores the last current-session values, with plan loads taking priority", () => {
  const exercise={id:3,name:"Гантели fixture",equipment:"dumbbell"};
  const current={exerciseId:3,weightKg:10.5,reps:8,rir:2,technique:"good"};
  const sets=[{...current,weightKg:10},{...current,weightKg:10.5}];
  assert.equal(selectWorkoutDraft(exercise,undefined,current,sets),current);
  const other=makeWorkoutDraft({id:1,name:"Жим штанги лёжа",equipment:"barbell"});
  assert.deepEqual(selectWorkoutDraft(exercise,undefined,other,sets),current);
  assert.deepEqual(selectWorkoutDraft(exercise,{weightKg:12,reps:10},other,sets),{...current,weightKg:12,reps:10});
  assert.equal(selectWorkoutDraft(exercise,undefined,other,[]).rir,null);
  assert.equal(selectWorkoutDraft({id:30,name:"Планка",equipment:"bodyweight"},undefined,other,[{exerciseId:30,weightKg:0,reps:0,durationSeconds:0}]).durationSeconds,30);
});

test("machine steps and dumbbell choices persist and invalid equipment settings cannot be saved", async () => {
  const machine=await create({weightStepKg:5});
  assert.equal(weightStep(machine),5);
  const dumbbell=await create({equipment:"dumbbell",weightStepKg:0.5,dumbbellCount:2});
  assert.equal(dumbbell.dumbbellCount,2);
  for(const settings of [{weightStepKg:0},{weightStepKg:21},{dumbbellCount:3},{dumbbellCount:2},{equipment:"barbell",loadMode:"assisted"},{name:"Планка",loadMode:"assisted"}]) await assert.rejects(create(settings),{status:400});
  const before=JSON.parse(await exportProgress());
  await assert.rejects(request(`/api/exercises/${machine.id}`,"PATCH",{weightStepKg:"5"}),{status:400});
  assert.deepEqual(JSON.parse(await exportProgress()).state,before.state);
  await restoreProgress(await exportProgress());
  assert.equal((await request("/api/exercises")).find(ex=>ex.id===dumbbell.id).dumbbellCount,2);
});

test("built-in exercise settings can change without changing protected identity", async () => {
  assert.equal((await request("/api/exercises/1","PATCH",{weightStepKg:1.25})).weightStepKg,1.25);
  await assert.rejects(request("/api/exercises/1","PATCH",{name:"Changed"}),{status:409});
  assert.deepEqual(weightPresets({equipment:"barbell",weightStepKg:5}),[20,40,60,80,100]);
  assert.ok(weightPresets({equipment:"machine",loadMode:"assisted",weightStepKg:5},25).every(value=>value<=25));
});

test("changing equipment settings invalidates an active draft revision without resetting selected ratings", async () => {
  const exercise=await create({equipment:"dumbbell",weightStepKg:0.5,dumbbellCount:1});
  const workout=await start();
  const current=await save(workout.id,{exerciseId:exercise.id,weightKg:10,reps:10,rir:2,technique:"good"});
  await request(`/api/exercises/${exercise.id}`,"PATCH",{dumbbellCount:2});
  await assert.rejects(commit(workout.id,current.revision),{status:409});
  const updated=await request(`/api/workouts/${workout.id}/draft`);
  assert.deepEqual(updated.draft,current.draft);
  assert.equal((await commit(workout.id,updated.revision)).set.volume,200);
});

test("dumbbell count snapshots affect only new sets, never legacy history or single-unit rank weights", async () => {
  const exercise=await create({equipment:"dumbbell",dumbbellCount:1});
  const first=await start(); await add(first.id,exercise.id,10,10); await finish(first.id);
  await request(`/api/exercises/${exercise.id}`,"PATCH",{dumbbellCount:2});
  assert.equal((await request(`/api/workouts/${first.id}`)).totalVolume,100);
  const second=await start(); const set=await add(second.id,exercise.id,10,10); await finish(second.id);
  assert.equal(set.volume,200); assert.equal(set.weightKg,10); assert.equal(set.dumbbellCount,2);
  assert.match(formatSetResult(set),/2 × 10/);
  await restoreProgress(await exportProgress());
  assert.equal((await request(`/api/workouts/${second.id}`)).totalVolume,200);
  assert.equal((await request("/api/exercises")).find(ex=>ex.id===exercise.id).rankBest,10);
});

test("counterweight reduces computed load and volume in active, history, statistics and levels", async () => {
  await request("/api/profile","PUT",{bodyWeightKg:80});
  const exercise=await create({loadMode:"assisted",weightStepKg:5});
  const workout=await start();
  const set=await add(workout.id,exercise.id,30,10);
  assert.equal(set.weightKg,30); assert.equal(set.effectiveWeightKg,50); assert.equal(set.volume,500);
  assert.match(formatSetResult(set),/Противовес 30/);
  assert.match(formatSetContext(set),/Расчётная нагрузка 50/);
  const report=await finish(workout.id);
  assert.equal(report.workout.totalVolume,500);
  assert.equal(report.newExerciseRecords.some(row=>row.kind==="max_weight"),false);
  assert.equal(report.newPersonalRecords.some(row=>row.kind==="max_weight"),false);
  assert.equal((await request("/api/stats/overview")).totalVolume,500);
  const second=await start(); await add(second.id,exercise.id,40,10); await finish(second.id);
  assert.equal((await request(`/api/workouts/${second.id}`)).totalVolume,400);
  assert.equal((await request(`/api/stats/exercises/${exercise.id}/progress`)).points[1].maxWeight,40);
  assert.equal((await request("/api/levels")).stats.mainExercises.find(ex=>ex.exerciseId===exercise.id).bestValue,50);
  await request("/api/profile","PUT",{bodyWeightKg:90});
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalVolume,500);
});

test("assisted sets require actual body mass and bounded counterweight; used load-mode cannot change", async () => {
  const exercise=await create({loadMode:"assisted"});
  const workout=await start();
  await assert.rejects(add(workout.id,exercise.id,20,10),{status:400});
  await request("/api/profile","PUT",{bodyWeightKg:80});
  await assert.rejects(add(workout.id,exercise.id,81,10),{status:400});
  await add(workout.id,exercise.id,20,10);
  await assert.rejects(request(`/api/exercises/${exercise.id}`,"PATCH",{loadMode:"weight"}),{status:409});
  assert.equal((await request(`/api/exercises/${exercise.id}`,"PATCH",{weightStepKg:10})).weightStepKg,10);
});

test("last-session preview excludes active work and other exercises, preserving order, units and snapshots", async () => {
  const exercise=await create({equipment:"dumbbell",dumbbellCount:2});
  const workout=await start(); await add(workout.id,exercise.id,10,10,{rir:2,technique:"good"}); await add(workout.id,exercise.id,12.5,8); await add(workout.id,30,0,0,{durationSeconds:45}); await finish(workout.id);
  const active=await start(); await add(active.id,exercise.id,20,5);
  const last=await request(`/api/exercises/${exercise.id}/last-sets`);
  assert.equal(last.workoutId,workout.id);
  assert.deepEqual(last.sets.map(set=>[set.weightKg,set.reps,set.dumbbellCount]),[[10,10,2],[12.5,8,2]]);
  assert.equal(last.sets[0].rir,2);
  assert.equal((await request("/api/exercises/30/last-sets")).sets[0].durationSeconds,45);
  assert.equal((await request("/api/exercises/1/last-sets")).workoutId,null);
});

test("backup10 validates equipment snapshots and retains import compatibility with old backups", async () => {
  await request("/api/profile","PUT",{bodyWeightKg:80});
  const exercise=await create({loadMode:"assisted"});
  const workout=await start(); await add(workout.id,exercise.id,30,10);
  const good=JSON.parse(await exportProgress()); assert.equal(good.version,10);
  for(const change of [copy=>copy.state.exercises.find(ex=>ex.id===exercise.id).weightStepKg=0,copy=>copy.state.sets[0].bodyWeightKg=20,copy=>copy.state.sets[0].loadMode="weight",copy=>copy.state.sets[0].dumbbellCount=2]) {
    const copy=structuredClone(good); change(copy); copy.checksum=createHash("sha256").update(JSON.stringify({state:copy.state,plans:copy.plans})).digest("hex");
    await assert.rejects(parseProgressBackup(JSON.stringify(copy)));
  }
  storage.clear(); await request("/api/exercises");
  const legacy=JSON.parse(await exportProgress()); legacy.version=8;
  await restoreProgress(JSON.stringify(legacy));
});

test("last-session preview selects the newer workout even when start timestamps are identical", async () => {
  const first=await start(); await add(first.id,1,20,10); await finish(first.id);
  const second=await start(); await add(second.id,1,25,8); await finish(second.id);
  const backup=JSON.parse(await exportProgress());
  backup.state.workouts[1].startedAt=backup.state.workouts[0].startedAt;
  backup.checksum=createHash("sha256").update(JSON.stringify({state:backup.state,plans:backup.plans})).digest("hex");
  await restoreProgress(JSON.stringify(backup));
  const last=await request("/api/exercises/1/last-sets");
  assert.equal(last.workoutId,second.id);
  assert.deepEqual(last.sets.map(set=>[set.weightKg,set.reps]),[[25,8]]);
});

test("AI cannot confuse counterweight with external load; ordinary exercise calibration respects hardware step and retains ratings", async () => {
  const assisted=await create({loadMode:"assisted"});
  const machine=await create({weightStepKg:5});
  const context=await request("/api/ai-coach/context","POST",{task:"next_workout"});
  assert.equal(context.catalog.some(ex=>ex.id===assisted.id),false);
  const reply={summary:"Calibration",cautions:[],nextSet:null,plan:{name:"Machine",description:"Test",exercises:[{exerciseId:machine.id,reason:"Test",targets:[1,2,3].map(()=>({weightKg:null,reps:8,durationSeconds:null}))}]}};
  const result=validateCoachReply(reply,context);
  const workout=await request("/api/ai-coach/apply-plan","POST",{context,fingerprint:await coachFingerprint(context),plan:setCoachProposal(result,context)});
  const current=await request(`/api/workouts/${workout.id}/draft`);
  const saved=await save(workout.id,{...current.draft,rir:4,technique:"good"});
  const next=await commit(workout.id,saved.revision);
  assert.equal(next.draft.weightKg,current.draft.weightKg+5);
  assert.equal(next.draft.rir,4); assert.equal(next.draft.technique,"good");
  const picked=await save(workout.id,makeWorkoutDraft(assisted));
  await assert.rejects(request("/api/ai-coach/context","POST",{task:"next_set",workoutId:workout.id}),/вручную/);
  const adjustment=await request("/api/ai-coach/context","POST",{task:"adjust_workout",workoutId:workout.id});
  assert.equal(adjustment.focus.workoutId,workout.id); assert.equal(adjustment.focus.draft,null);
  assert.ok(picked.revision>0);
});
