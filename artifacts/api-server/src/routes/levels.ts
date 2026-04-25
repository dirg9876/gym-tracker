import { Router, type IRouter } from "express";
import { computeCurrentLevel } from "../lib/levels";

const router: IRouter = Router();

router.get("/levels", async (_req, res): Promise<void> => {
  const info = await computeCurrentLevel();
  res.json({
    levels: info.levels,
    currentLevel: info.currentLevel,
    bestLevelEver: info.bestLevelEver,
    nextLevel: info.nextLevel,
    confirmedLevel: info.confirmedLevel,
    nextLevelPenaltyMultiplier: info.nextLevelPenaltyMultiplier,
    nextLevelTonnage7dKgRequired: info.nextLevelTonnage7dKgRequired,
    bodyWeightKg: info.bodyWeightKg,
    bodyWeightIsFallback: info.bodyWeightIsFallback,
    stats: info.stats,
  });
});

export default router;
