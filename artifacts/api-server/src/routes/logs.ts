import { Router } from "express";
import { db } from "@workspace/db";
import { activityTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const {
    page = "1",
    limit = "50",
    action,
    entityType,
    screenId,
    from,
    to,
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * pageSize;

  const conditions = [];

  if (role !== "admin") {
    conditions.push(eq(activityTable.userId, userId));
  }
  if (action) conditions.push(eq(activityTable.action, action));
  if (entityType) conditions.push(eq(activityTable.entityType, entityType));
  if (screenId) conditions.push(eq(activityTable.screenId, parseInt(screenId)));
  if (from) conditions.push(gte(activityTable.createdAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(activityTable.createdAt, toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRow] = await Promise.all([
    db.select().from(activityTable)
      .where(where)
      .orderBy(desc(activityTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(activityTable)
      .where(where),
  ]);

  res.json({
    items: rows.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    total: countRow[0]?.count ?? 0,
    page: pageNum,
    pageSize,
  });
});

export default router;
