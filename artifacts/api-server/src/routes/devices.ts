import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable, screensTable } from "@workspace/db";
import { eq, desc, and, isNull, sql, ne } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateScreenCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

const router = Router();

async function resolveApprovedDevice(serial: string) {
  // 1. Exact match — approved
  const [exact] = await db.select().from(devicesTable)
    .where(eq(devicesTable.serial, serial)).limit(1);
  if (exact?.status === "approved") return exact;

  // 2. Suffix match in JS: fetch all approved devices and find one whose
  //    serial ends with our serial or vice-versa.
  //    Handles "2872" → "25616A000002872" (Novastar short vs full serial).
  if (serial.length >= 4) {
    const approved = await db.select().from(devicesTable)
      .where(eq(devicesTable.status, "approved"));

    const matches = approved.filter(d =>
      d.serial.endsWith(serial) || serial.endsWith(d.serial)
    );

    if (matches.length >= 1) {
      // If all matches share the same screenCode, they're the same device — not ambiguous
      const codes = new Set(matches.map(d => d.screenCode).filter(Boolean));
      if (codes.size === 1) return matches[0];
      // Prefer the longest serial (most specific match)
      if (matches.length > 1) {
        return matches.reduce((a, b) => a.serial.length >= b.serial.length ? a : b);
      }
      return matches[0];
    }
  }

  // Return the exact record even if pending (so the caller can handle it)
  return exact ?? null;
}

// Called by APK — no auth required
// Auto-creates a pending record on first contact if not already registered
router.get("/check/:serial", async (req, res) => {
  const serial = req.params.serial?.trim().toUpperCase();
  if (!serial) { res.status(400).json({ error: "Serial inválido" }); return; }

  const device = await resolveApprovedDevice(serial);

  if (!device) {
    await db.insert(devicesTable).values({ serial, status: "pending" })
      .onConflictDoNothing();
    res.json({ status: "pending", approved: false, screenCode: null });
    return;
  }

  if (device.status !== "approved") {
    res.json({
      status: device.status,
      approved: false,
      screenCode: null,
      name: device.name ?? null,
    });
    return;
  }

  // Device approved — ensure a screen exists and is linked
  const code = device.screenCode ?? generateScreenCode();
  const screenName = device.name ? `Tela - ${device.name}` : `Tela - ${serial.slice(-6)}`;

  const [existingScreen] = await db.select().from(screensTable)
    .where(eq(screensTable.code, code)).limit(1);

  if (!existingScreen) {
    await db.insert(screensTable)
      .values({ name: screenName, code, userId: device.userId ?? null })
      .onConflictDoNothing();
  }

  if (!device.screenCode) {
    await db.update(devicesTable)
      .set({ screenCode: code })
      .where(eq(devicesTable.serial, device.serial));
  }

  // Also update the pending alias serial to point to the same screen code
  // so future polls from this alias are fast (exact match next time)
  if (device.serial !== serial) {
    await db.update(devicesTable)
      .set({ screenCode: code, status: "approved", name: device.name ?? null, userId: device.userId ?? null })
      .where(and(eq(devicesTable.serial, serial), sql`status != 'approved'`));
  }

  res.json({ status: "approved", approved: true, screenCode: code, name: device.name ?? null });
});

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const rows = role === "admin"
    ? await db.select().from(devicesTable).orderBy(desc(devicesTable.createdAt))
    : await db.select().from(devicesTable)
        .where(eq(devicesTable.userId, userId))
        .orderBy(desc(devicesTable.createdAt));

  res.json(rows);
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const isAdmin = role === "admin";

  const { serial, name, location, notes, screenCode, status } = req.body as {
    serial: string; name?: string; location?: string; notes?: string; screenCode?: string; status?: string;
  };

  if (!serial?.trim()) { res.status(400).json({ error: "Serial é obrigatório" }); return; }
  const normalizedSerial = serial.trim().toUpperCase();

  // Determine status: admins can set any status; operators always create as pending
  const deviceStatus = isAdmin ? (status ?? "approved") : "pending";
  const approved = deviceStatus === "approved";

  // Check if a record already exists (e.g. auto-created by APK first contact)
  const [existing] = await db.select().from(devicesTable)
    .where(eq(devicesTable.serial, normalizedSerial)).limit(1);

  if (existing) {
    // Record already exists — check ownership
    if (existing.userId && existing.userId !== userId && !isAdmin) {
      res.status(409).json({ error: "Este serial já está registrado por outro usuário" });
      return;
    }
    // Claim or update the existing record (e.g. APK auto-created without userId)
    const claimedUserId = existing.userId ?? userId;
    const [updated] = await db.update(devicesTable).set({
      userId: claimedUserId,
      name: name?.trim() || existing.name,
      location: location?.trim() || existing.location,
      notes: notes?.trim() || existing.notes,
      screenCode: screenCode?.trim() || existing.screenCode,
      // Only update status if admin or if record was unclaimed
      ...(isAdmin ? { status: deviceStatus, approvedAt: approved ? (existing.approvedAt ?? new Date()) : null } : {}),
    }).where(eq(devicesTable.serial, normalizedSerial)).returning();

    // If device was unclaimed (null userId), also assign any linked screens to this user
    if (!existing.userId && updated.screenCode) {
      await db.update(screensTable)
        .set({ userId: claimedUserId })
        .where(and(eq(screensTable.code, updated.screenCode), isNull(screensTable.userId)));
    }

    res.status(200).json(updated);
    return;
  }

  // New record
  try {
    const [device] = await db.insert(devicesTable).values({
      serial: normalizedSerial,
      name: name?.trim() || null,
      location: location?.trim() || null,
      notes: notes?.trim() || null,
      screenCode: screenCode?.trim() || null,
      status: deviceStatus,
      userId,
      approvedAt: approved ? new Date() : null,
    }).returning();
    res.status(201).json(device);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Este serial já está cadastrado" });
    } else {
      throw err;
    }
  }
});

router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const isAdmin = role === "admin";
  const deviceId = Number(req.params.id);

  const [existing] = await db.select().from(devicesTable)
    .where(eq(devicesTable.id, deviceId)).limit(1);
  if (!existing) { res.status(404).json({ error: "Dispositivo não encontrado" }); return; }
  if (!isAdmin && existing.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { serial, name, location, notes, screenCode, status } = req.body as any;

  // Operators cannot change the approval status
  if (status !== undefined && !isAdmin) {
    res.status(403).json({ error: "Apenas administradores podem alterar o status do dispositivo" });
    return;
  }

  const update: Record<string, unknown> = {};
  if (serial !== undefined)     update.serial     = serial?.trim().toUpperCase() ?? existing.serial;
  if (name !== undefined)       update.name       = name       ?? null;
  if (location !== undefined)   update.location   = location   ?? null;
  if (notes !== undefined)      update.notes      = notes      ?? null;
  if (screenCode !== undefined) update.screenCode = screenCode ?? null;
  if (status !== undefined && isAdmin) {
    update.status = status;
    if (status === "approved" && !existing.approvedAt) update.approvedAt = new Date();
    if (status !== "approved") update.approvedAt = null;
  }

  const [updated] = await db.update(devicesTable).set(update)
    .where(eq(devicesTable.id, deviceId)).returning();
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const isAdmin = role === "admin";
  const deviceId = Number(req.params.id);

  const [existing] = await db.select().from(devicesTable)
    .where(eq(devicesTable.id, deviceId)).limit(1);
  if (!existing) { res.status(404).json({ error: "Dispositivo não encontrado" }); return; }
  if (!isAdmin && existing.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  // Operators can only delete their own pending/rejected devices
  if (!isAdmin && existing.status === "approved") {
    res.status(403).json({ error: "Não é possível remover um dispositivo aprovado. Contate o administrador." });
    return;
  }

  await db.delete(devicesTable).where(eq(devicesTable.id, deviceId));
  res.status(204).send();
});

export default router;
