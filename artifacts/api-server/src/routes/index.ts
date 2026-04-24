import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exercisesRouter from "./exercises";
import workoutsRouter from "./workouts";
import statsRouter from "./stats";
import levelsRouter from "./levels";
import programsRouter from "./programs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(exercisesRouter);
router.use(workoutsRouter);
router.use(statsRouter);
router.use(levelsRouter);
router.use(programsRouter);

export default router;
