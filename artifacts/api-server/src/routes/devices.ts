import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable, screensTable, schedulesTable, playlistsTable, mediaPlaysTable, operatorsTable } from "@workspace/db";
import { eq, desc, and, isNull, sql, inArray, gte } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hitRateLimit } from "../lib/rateLimit";

function generateScreenCode() {
  return randomBytes(8).toString("hex").toUpperCase();
}

const router = Router();

async function resolveApprovedDevice(serial: string) {
  // Try exact match first, then suffix match (user may have registered only last 8 chars displayed on screen)
  const [exact] = await db.select().from(devicesTable)
    .where(eq(devicesTable.serial, serial)).limit(1);
  if (exact) return exact;

  const [suffix] = await db.select().from(devicesTable)
    .where(sql`${serial} LIKE '%' || upper(${devicesTable.serial})`)
    .limit(1);
  return suffix ?? null;
}

// Called by APK — no auth required
// Does NOT auto-create records; device must be pre-registered by an admin/operator
router.get("/check/:serial", async (req, res) => {
  const serial = req.params.serial?.trim().toUpperCase();
  if (!serial) { res.status(400).json({ error: "Serial inválido" }); return; }
  const ip = ((req.ip ?? req.socket.remoteAddress ?? "unknown").split(",")[0]).trim();
  if (hitRateLimit(`device-check:${ip}:${serial}`, 60, 10 * 60 * 1000)) {
    res.status(429).json({ error: "Muitas requisições. Aguarde." }); return;
  }

  const device = await resolveApprovedDevice(serial);

  if (!device) {
    res.json({ status: "unknown", approved: false });
    return;
  }

  if (device.status !== "approved") {
    res.json({ status: device.status, approved: false });
    return;
  }

  // Device approved — ensure a screen exists and is linked
  const code = device.screenCode ?? generateScreenCode();
  const screenName = device.name ? `Tela - ${device.name}` : `Tela - ${serial.slice(-6)}`;

  const [existingScreen] = await db.select({ id: screensTable.id })
    .from(screensTable)
    .where(eq(screensTable.code, code)).limit(1);

  if (!existingScreen) {
    try {
      // Use raw SQL to avoid Drizzle enumerating all schema columns (VPS schema drift)
      await db.execute(
        sql`INSERT INTO screens (name, code, user_id, location, status)
            VALUES (${screenName}, ${code}, ${device.userId ?? null}, null, 'unknown')
            ON CONFLICT DO NOTHING`
      );
    } catch { /* non-fatal */ }
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

  // Auto-pair: generate a deviceToken and save to the screen so the player
  // can navigate directly without manual code entry (no keyboard needed on TV Box)
  const deviceToken = randomBytes(32).toString("hex");
  try {
    await db.execute(
      sql`UPDATE screens SET device_token = ${deviceToken}, last_seen = NOW()
          WHERE code = ${code}`
    );
  } catch { /* non-fatal — player falls back to manual pairing */ }

  res.json({ status: "approved", approved: true, screenCode: code, deviceToken });
});

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  // Colunas seguras (existem desde o início do schema)
  const safeDeviceCols = {
    id: devicesTable.id,
    serial: devicesTable.serial,
    name: devicesTable.name,
    location: devicesTable.location,
    notes: devicesTable.notes,
    status: devicesTable.status,
    screenCode: devicesTable.screenCode,
    userId: devicesTable.userId,
  };

  let rows: any[];
  try {
    // Tenta com createdAt e approvedAt
    const fullCols = { ...safeDeviceCols, createdAt: devicesTable.createdAt, approvedAt: devicesTable.approvedAt };
    rows = role === "admin"
      ? await db.select(fullCols).from(devicesTable).orderBy(desc(devicesTable.createdAt))
      : await db.select(fullCols).from(devicesTable).where(eq(devicesTable.userId, userId)).orderBy(desc(devicesTable.createdAt));
  } catch {
    try {
      // Fallback sem colunas de timestamp novas
      rows = role === "admin"
        ? await db.select(safeDeviceCols).from(devicesTable).orderBy(desc(devicesTable.id))
        : await db.select(safeDeviceCols).from(devicesTable).where(eq(devicesTable.userId, userId)).orderBy(desc(devicesTable.id));
    } catch (err2) {
      req.log.error({ err: err2 }, "devices GET: fetch failed");
      res.json([]);
      return;
    }
  }

  // Enrich with the linked screen's live data
  const codes = rows.map((d: any) => d.screenCode).filter((c: any): c is string => !!c);

  // Colunas mínimas de screens para não travar se schema estiver desatualizado
  const safeScreenCols = {
    id: screensTable.id,
    code: screensTable.code,
    lastSeen: screensTable.lastSeen,
    resolution: screensTable.resolution,
    defaultPlaylistId: screensTable.defaultPlaylistId,
  };

  const screenByCode = new Map<string, any>();
  if (codes.length > 0) {
    try {
      // Tenta com todas as colunas de screen
      const linkedScreens = await db.select({
        ...safeScreenCols,
        tags: screensTable.tags,
        powerScheduleJson: screensTable.powerScheduleJson,
        timezone: screensTable.timezone,
        powerOnTime: screensTable.powerOnTime,
        powerOffTime: screensTable.powerOffTime,
        panelWidth: screensTable.panelWidth,
        panelHeight: screensTable.panelHeight,
      }).from(screensTable).where(inArray(screensTable.code, codes));
      for (const s of linkedScreens) screenByCode.set(s.code, s);
    } catch {
      try {
        // Fallback com colunas mínimas
        const linkedScreens = await db.select(safeScreenCols).from(screensTable).where(inArray(screensTable.code, codes));
        for (const s of linkedScreens) screenByCode.set(s.code, s);
      } catch (err2) {
        req.log.warn({ err: err2 }, "devices GET: screen lookup failed (non-fatal)");
      }
    }
  }

  const screenIds = Array.from(screenByCode.values()).map((s: any) => s.id as number);

  const activePlaylistByScreenId = new Map<number, string>();
  if (screenIds.length > 0) {
    try {
      const activeSchedules = await db
        .select({ screenId: schedulesTable.screenId, playlistName: playlistsTable.name })
        .from(schedulesTable)
        .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
        .where(and(inArray(schedulesTable.screenId, screenIds), eq(schedulesTable.active, true)));
      for (const s of activeSchedules) {
        if (s.playlistName) activePlaylistByScreenId.set(s.screenId, s.playlistName);
      }
    } catch (err) {
      req.log.warn({ err }, "devices GET: active schedules lookup failed (non-fatal)");
    }
  }

  const lastPlayByScreenId = new Map<number, { mediaName: string; playedAt: Date }>();
  const playsTodayByScreenId = new Map<number, number>();
  if (screenIds.length > 0) {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const recentPlays = await db
        .select({ screenId: mediaPlaysTable.screenId, mediaName: mediaPlaysTable.mediaName, playedAt: mediaPlaysTable.playedAt })
        .from(mediaPlaysTable)
        .where(and(inArray(mediaPlaysTable.screenId, screenIds), gte(mediaPlaysTable.playedAt, todayStart)))
        .orderBy(desc(mediaPlaysTable.playedAt))
        .limit(2000);
      for (const p of recentPlays) {
        if (!p.screenId) continue;
        if (!lastPlayByScreenId.has(p.screenId)) lastPlayByScreenId.set(p.screenId, { mediaName: p.mediaName, playedAt: p.playedAt });
        playsTodayByScreenId.set(p.screenId, (playsTodayByScreenId.get(p.screenId) ?? 0) + 1);
      }
    } catch (err) {
      req.log.warn({ err }, "devices GET: media_plays lookup failed (non-fatal)");
    }
  }

  // Batch operator name lookup
  const distinctUserIds = [...new Set(rows.map((d: any) => d.userId).filter((u: any): u is string => !!u))];
  const operatorNameById = new Map<string, string>();
  if (distinctUserIds.length > 0) {
    try {
      const ops = await db
        .select({ id: operatorsTable.id, name: operatorsTable.name })
        .from(operatorsTable)
        .where(inArray(sql`${operatorsTable.id}::text`, distinctUserIds));
      for (const op of ops) operatorNameById.set(String(op.id), op.name);
    } catch (err) {
      req.log.warn({ err }, "devices GET: operator name lookup failed (non-fatal)");
    }
  }

  const TWO_MINUTES = 2 * 60 * 1000;
  const nowMs = Date.now();

  const result = rows.map((d: any) => {
    const operatorName = d.userId ? (operatorNameById.get(d.userId) ?? null) : null;
    const screen = d.screenCode ? screenByCode.get(d.screenCode) : undefined;
    if (!screen) {
      return { ...d, operatorName, screenStatus: null, resolution: null, activePlaylistName: null, lastPlay: null, playsToday: 0, tags: null, powerScheduleJson: null, screenLastSeen: null };
    }
    const lp = lastPlayByScreenId.get(screen.id);
    return {
      ...d,
      operatorName,
      screenStatus: screen.lastSeen ? (nowMs - screen.lastSeen.getTime() < TWO_MINUTES ? "online" : "offline") : "unknown",
      resolution: screen.resolution ?? null,
      activePlaylistName: activePlaylistByScreenId.get(screen.id) ?? null,
      lastPlay: lp ? { mediaName: lp.mediaName, playedAt: lp.playedAt.toISOString() } : null,
      playsToday: playsTodayByScreenId.get(screen.id) ?? 0,
      tags: screen.tags ?? null,
      powerScheduleJson: screen.powerScheduleJson ?? null,
      screenLastSeen: screen.lastSeen?.toISOString() ?? null,
      screenId: screen.id,
      screenTimezone: screen.timezone ?? null,
      screenPowerOnTime: screen.powerOnTime ?? null,
      screenPowerOffTime: screen.powerOffTime ?? null,
      screenPanelWidth: screen.panelWidth ?? null,
      screenPanelHeight: screen.panelHeight ?? null,
    };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const isAdmin = role === "admin";

  const { serial, name, location, notes, screenCode, status, assignedUserId } = req.body as {
    serial: string; name?: string; location?: string; notes?: string; screenCode?: string; status?: string; assignedUserId?: string;
  };

  if (!serial?.trim()) { res.status(400).json({ error: "Serial é obrigatório" }); return; }
  const normalizedSerial = serial.trim().toUpperCase();

  // Determine status: admins can set any status; operators always create as pending
  const deviceStatus = isAdmin ? (status ?? "approved") : "pending";
  const approved = deviceStatus === "approved";

  // When admin specifies a target operator, use their userId instead of the admin's
  const effectiveUserId = (isAdmin && assignedUserId) ? assignedUserId : userId;

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
    const claimedUserId = existing.userId ?? effectiveUserId;
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
      userId: effectiveUserId,
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

  // Sincroniza nome na tela vinculada
  if (name !== undefined && updated.screenCode) {
    await db.update(screensTable)
      .set({ name: name?.trim() || existing.name || updated.serial })
      .where(eq(screensTable.code, updated.screenCode));
  }

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

  // Operators can delete any of their own devices

  await db.delete(devicesTable).where(eq(devicesTable.id, deviceId));
  res.status(204).send();
});

export default router;
