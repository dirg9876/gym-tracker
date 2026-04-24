import { Router, type IRouter } from "express";
import { LEVELS, computeCurrentLevel } from "../lib/levels";

const router: IRouter = Router();

router.get("/levels", async (_req, res): Promise<void> => {
  const info = await computeCurrentLevel();
  res.json({
    levels: LEVELS,
    currentLevel: info.currentLevel,
    nextLevel: info.nextLevel,
    stats: info.stats,
  });
});

export default router;
