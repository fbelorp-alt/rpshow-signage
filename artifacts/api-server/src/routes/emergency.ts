import { Router } from "express";
import { db } from "@workspace/db";
import { emergencyAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// Get active alert for user
router.get("/active", async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  if (!userId) { res.json(null); return; }

  const now = new Date();
  const alerts = await db.select().from(emergencyAlertsTable)
    .where(and(eq(emergencyAlertsTable.userId, userId), eq(emergencyAlertsTable.isActive, true)));

  // Filter out expired ones and deactivate them
  const active = alerts.find(a => !a.expiresAt || a.expiresAt > now);
  const expired = alerts.filter(a => a.expiresAt && a.expiresAt <= now);
  if (expired.length) {
    for (const a of expired) {
      await db.update(emergencyAlertsTable).set({ isActive: false }).where(eq(emergencyAlertsTable.id, a.id));
    }
  }

  res.json(active ?? null);
});

// List all alerts
router.get("/", async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  if (!userId) { res.json([]); return; }
  const alerts = await db.select().from(emergencyAlertsTable)
    .where(eq(emergencyAlertsTable.userId, userId));
  res.json(alerts);
});

// Create emergency alert
router.post("/", async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const { message, bgColor, textColor, durationMinutes } = req.body as {
    message: string;
    bgColor?: string;
    textColor?: string;
    durationMinutes?: number;
  };

  if (!message?.trim()) { res.status(400).json({ error: "Mensagem obrigatória" }); return; }

  // Deactivate any existing active alert first
  if (userId) {
    await db.update(emergencyAlertsTable).set({ isActive: false })
      .where(and(eq(emergencyAlertsTable.userId, userId), eq(emergencyAlertsTable.isActive, true)));
  }

  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  const [alert] = await db.insert(emergencyAlertsTable).values({
    userId: userId ?? null,
    message: message.trim(),
    bgColor: bgColor ?? "#DC2626",
    textColor: textColor ?? "#FFFFFF",
    isActive: true,
    expiresAt,
  }).returning();

  res.status(201).json(alert);
});

// Cancel alert
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(emergencyAlertsTable).set({ isActive: false }).where(eq(emergencyAlertsTable.id, id));
  res.status(204).send();
});

export default router;
