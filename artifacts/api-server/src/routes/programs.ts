import { Router, type IRouter } from "express";
import { buildProgramPlan, listPrograms } from "../lib/programs";

const router: IRouter = Router();

router.get("/programs", async (_req, res): Promise<void> => {
  const programs = await listPrograms();
  res.json({ programs });
});

router.get("/programs/:programId", async (req, res): Promise<void> => {
  const programId = String(req.params.programId);
  const plan = await buildProgramPlan(programId);
  if (!plan) {
    res.status(404).json({ error: "Программа не найдена" });
    return;
  }
  res.json(plan);
});

export default router;
