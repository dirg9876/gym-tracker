import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, exercisesTable } from "@workspace/db";
import {
  ListExercisesResponse,
  CreateExerciseBody,
  DeleteExerciseParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exercises", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(exercisesTable)
    .orderBy(exercisesTable.muscleGroup, exercisesTable.name);
  res.json(ListExercisesResponse.parse(rows));
});

router.post("/exercises", async (req, res): Promise<void> => {
  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(exercisesTable)
    .values({
      name: parsed.data.name.trim(),
      muscleGroup: parsed.data.muscleGroup.trim(),
      isCustom: true,
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/exercises/:exerciseId", async (req, res): Promise<void> => {
  const params = DeleteExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(exercisesTable)
    .where(eq(exercisesTable.id, params.data.exerciseId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  res.sendStatus(204);
});

export default router;
