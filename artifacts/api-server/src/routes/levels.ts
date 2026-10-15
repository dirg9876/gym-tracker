import { Router, type IRouter } from "express";
import { computeCurrentLevel } from "../lib/levels";
import { setConfirmedLevel, setLevelUpAt } from "../lib/profile";

const router: IRouter = Router();

router.get("/levels", async (req, res): Promise<void> => {
  const userId = req.userId;
  const info = await computeCurrentLevel(userId);
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
    barWeightKg: info.barWeightKg,
    levelFactorAnchor: info.levelFactorAnchor,
    currentRank: info.currentRank,
    weightClassKg: info.weightClassKg,
    sex: info.sex,
    confirmedLevelMigrationNeeded: info.confirmedLevelMigrationNeeded,
    maxClaimableLevel: info.maxClaimableLevel,
    stats: info.stats,
  });
});

router.post("/levels/claim/:level", async (req, res): Promise<void> => {
  const userId = req.userId;
  const targetLevel = Number(req.params.level);
  if (!Number.isInteger(targetLevel) || targetLevel < 1) {
    res.status(400).json({ error: "Invalid level" });
    return;
  }
  const info = await computeCurrentLevel(userId);
  if (targetLevel <= info.confirmedLevel) {
    res.status(400).json({ error: "Target level must be above current confirmed level" });
    return;
  }
  if (info.maxClaimableLevel === null || targetLevel > info.maxClaimableLevel) {
    res.status(400).json({ error: "Requirements not met for this level" });
    return;
  }
  await setConfirmedLevel(userId, targetLevel);
  await setLevelUpAt(userId, new Date());
  res.json({ confirmedLevel: targetLevel });
});

export default router;
