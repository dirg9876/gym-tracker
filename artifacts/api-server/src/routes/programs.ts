import { Router, type IRouter } from "express";
import { CreateCustomProgramBody, UpdateCustomProgramBody } from "@workspace/api-zod";
import { buildProgramPlan, listPrograms, createCustomProgram, deleteCustomProgram, updateCustomProgram } from "../lib/programs";

const router: IRouter = Router();

router.get("/programs", async (req, res): Promise<void> => {
  const programs = await listPrograms(req.userId);
  res.json({ programs });
});

router.post("/programs", async (req, res): Promise<void> => {
  const parsed = CreateCustomProgramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные", details: parsed.error.flatten() });
    return;
  }
  const result = await createCustomProgram(req.userId, {
    name: parsed.data.name,
    description: parsed.data.description,
    exercises: parsed.data.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      intent: ex.intent as "strength" | "hypertrophy" | "accessory",
      note: ex.note,
    })),
  });
  res.status(201).json(result);
});

router.get("/programs/:programId", async (req, res): Promise<void> => {
  const programId = String(req.params.programId);
  const plan = await buildProgramPlan(programId, req.userId);
  if (!plan) {
    res.status(404).json({ error: "Программа не найдена" });
    return;
  }
  res.json(plan);
});

router.put("/programs/:programId", async (req, res): Promise<void> => {
  const programId = String(req.params.programId);
  const parsed = UpdateCustomProgramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные", details: parsed.error.flatten() });
    return;
  }
  const { status, item } = await updateCustomProgram(programId, req.userId, {
    name: parsed.data.name,
    description: parsed.data.description,
    exercises: parsed.data.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      intent: ex.intent as "strength" | "hypertrophy" | "accessory",
      note: ex.note,
    })),
  });
  if (status === "not_found") {
    res.status(404).json({ error: "Программа не найдена" });
    return;
  }
  if (status === "forbidden") {
    res.status(403).json({ error: "Нельзя изменить эту программу" });
    return;
  }
  res.json(item);
});

router.delete("/programs/:programId", async (req, res): Promise<void> => {
  const programId = String(req.params.programId);
  const { status } = await deleteCustomProgram(programId, req.userId);
  if (status === "not_found") {
    res.status(404).json({ error: "Программа не найдена" });
    return;
  }
  if (status === "forbidden") {
    res.status(403).json({ error: "Нельзя удалить эту программу" });
    return;
  }
  res.status(204).send();
});

export default router;
