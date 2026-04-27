import { Router } from "express";
import { db, pageViewsTable } from "@workspace/db";
import { sql, eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/analytics/pageview", async (req, res) => {
  const { page } = req.body as { page?: string };
  if (!page || typeof page !== "string") {
    res.status(400).json({ error: "page is required" });
    return;
  }
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = now.getUTCHours();

  await db
    .insert(pageViewsTable)
    .values({ page, date, hour, count: 1 })
    .onConflictDoUpdate({
      target: [pageViewsTable.page, pageViewsTable.date, pageViewsTable.hour],
      set: { count: sql`${pageViewsTable.count} + 1`, recordedAt: sql`now()` },
    });

  res.json({ ok: true });
});

router.get("/analytics/stats", requireAuth, async (_req, res) => {
  const [totalRow] = await db
    .select({ total: sql<number>`sum(${pageViewsTable.count})::int` })
    .from(pageViewsTable);

  const today = new Date().toISOString().slice(0, 10);
  const [todayRow] = await db
    .select({ total: sql<number>`sum(${pageViewsTable.count})::int` })
    .from(pageViewsTable)
    .where(eq(pageViewsTable.date, today));

  const byPage = await db
    .select({
      page: pageViewsTable.page,
      total: sql<number>`sum(${pageViewsTable.count})::int`,
    })
    .from(pageViewsTable)
    .groupBy(pageViewsTable.page)
    .orderBy(desc(sql`sum(${pageViewsTable.count})`));

  const last7Days = await db
    .select({
      date: pageViewsTable.date,
      total: sql<number>`sum(${pageViewsTable.count})::int`,
    })
    .from(pageViewsTable)
    .where(
      sql`${pageViewsTable.date} >= (current_date - interval '6 days')::text`
    )
    .groupBy(pageViewsTable.date)
    .orderBy(pageViewsTable.date);

  res.json({
    total: totalRow?.total ?? 0,
    today: todayRow?.total ?? 0,
    byPage,
    last7Days,
  });
});

export default router;
