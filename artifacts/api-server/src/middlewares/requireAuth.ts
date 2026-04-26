import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";

// In development, allow a fallback user ID so the app can be exercised without
// a full Clerk frontend setup. Requires DEV_USER_ID to be explicitly set in
// the environment — no implicit default. This path is NEVER taken in production.
const DEV_FALLBACK_USER_ID =
  process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID
    ? process.env.DEV_USER_ID
    : null;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId as string) || auth?.userId;
  if (!userId) {
    if (DEV_FALLBACK_USER_ID) {
      req.userId = DEV_FALLBACK_USER_ID;
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}
