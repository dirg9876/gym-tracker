import { Router, type IRouter } from "express";
import { UpdateProfileBody } from "@workspace/api-zod";
import { getProfile, updateProfile } from "../lib/profile";

const router: IRouter = Router();

router.get("/profile", async (_req, res): Promise<void> => {
  const userId = "";
  const profile = await getProfile(userId);
  res.json(profile);
});

router.put("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = "";
  const profile = await updateProfile(userId, parsed.data);
  res.json(profile);
});

export default router;
