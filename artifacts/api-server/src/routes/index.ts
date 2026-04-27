import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import healthRouter from "./health";
import exercisesRouter from "./exercises";
import workoutsRouter from "./workouts";
import statsRouter from "./stats";
import levelsRouter from "./levels";
import programsRouter from "./programs";
import profileRouter from "./profile";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyticsRouter);
router.use(requireAuth);
router.use(exercisesRouter);
router.use(workoutsRouter);
router.use(statsRouter);
router.use(levelsRouter);
router.use(programsRouter);
router.use(profileRouter);

export default router;
