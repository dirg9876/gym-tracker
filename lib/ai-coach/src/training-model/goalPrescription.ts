type Goal = "general" | "strength" | "hypertrophy";
type Exercise = { name: string; muscleGroup: string; equipment: string };

// Movement-name classification is a catalog heuristic, not a scientific finding.
// Unknown movements use the conservative compound default, not an inferred 1RM.
export function isIsolationExercise(exercise: Exercise): boolean {
  if (/икр|на носки|французск|разводк|разведени|мах[иов]?|молот|сгибани|разгибани|бицепс|скручивани|подъ[её]м ног/i.test(exercise.name)) return true;
  if (/жим|отжимани|брусь|подтяг|тяга|присед|выпад/i.test(exercise.name)) return false;
  return ["Бицепс", "Трицепс", "Икры", "Пресс"].includes(exercise.muscleGroup);
}

export function goalPrescription(goal: Goal, exercise: Exercise) {
  const isolation = isIsolationExercise(exercise);
  const strength = goal === "strength" && !isolation;
  const bodyweightPractice = goal === "general" && !isolation && exercise.equipment === "bodyweight";
  const repsMin = strength ? 3 : bodyweightPractice ? 6 : isolation ? 10 : 8;
  const repsMax = strength ? 6 : bodyweightPractice ? 10 : isolation ? 15 : 12;
  const label = goal === "hypertrophy" ? "Мышцы" : goal === "strength" ? "Сила" : "Общая форма";
  return { repsMin, repsMax, targetRir: 2,
    intent: strength ? "strength" as const : isolation ? "accessory" as const : "hypertrophy" as const,
    basis: `Цель «${label}»: ${isolation ? "изоляция" : "основное движение"}, ${repsMin}–${repsMax} повт., целевой запас 2.` };
}
