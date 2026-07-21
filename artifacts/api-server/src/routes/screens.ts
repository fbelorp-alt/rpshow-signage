import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, schedulesTable, playlistsTable, activityTable, mediaPlaysTable, devicesTable, usersTable, brightnessSchedulesTable } from "@workspace/db";
import { eq, and, desc, gte, inArray, or, isNull, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  UpdateScreenBody,
  UpdateScreenParams,
  GetScreenParams,
  DeleteScreenParams,
  PairScreenBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";
import { hitRateLimit } from "../lib/rateLimit";

const router = Router();

function generateCode(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}

router.post("/pair", async (req, res) => {
  const ip = ((req.ip ?? req.socket.remoteAddress ?? "unknown").split(",")[0]).trim();
  if (hitRateLimit(`pair:${ip}`, 20, 10 * 60 * 1000)) {
    res.status(429).json({ error: "Muitas tentativas de pareamento. Aguarde." }); return;
  }
  const body = PairScreenBody.parse(req.body);
  const codeUpper = body.pairingCode.trim().toUpperCase();

  const [screen] = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.code, codeUpper))
    .limit(1);

  if (!screen) {
    res.status(404).json({ error: "Código de pareamento inválido. Verifique o código na página Telas." });
    return;
  }

  await db
    .update(screensTable)
    .set({ lastSeen: new Date() })
    .where(eq(screensTable.id, screen.id));

  await db.insert(activityTable).values({
    userId: screen.userId ?? undefined,
    action: "paired",
    entityType: "screen",
    entityName: screen.name,
  });

  res.status(201).json({
    id: screen.id,
    name: screen.name,
    code: screen.code,
    location: screen.location ?? null,
    status: screen.status,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  // For operators: also include screens linked to their approved devices (handles legacy null-userId screens)
  let whereClause: ReturnType<typeof eq> | ReturnType<typeof or> | undefined;
  if (role !== "admin") {
    const userDevices = await db
      .select({ screenCode: devicesTable.screenCode })
      .from(devicesTable)
      .where(and(eq(devicesTable.userId, userId), isNotNull(devicesTable.screenCode)));
    const deviceCodes = userDevices.map(d => d.screenCode!).filter(Boolean);

    // Inclui telas com userId do operador OU telas com userId=null vinculadas a devices do operador
    whereClause = deviceCodes.length > 0
      ? or(
          eq(screensTable.userId, userId),
          and(isNull(screensTable.userId), inArray(screensTable.code, deviceCodes))
        )
      : eq(screensTable.userId, userId);

    // Self-heal: assign any null-userId screens that belong to this user's devices
    if (deviceCodes.length > 0) {
      await db.update(screensTable)
        .set({ userId })
        .where(and(isNull(screensTable.userId), inArray(screensTable.code, deviceCodes)));
    }
  }

  const rows = await db
    .select({
      id: screensTable.id,
      name: screensTable.name,
      clientId: screensTable.clientId,
      userId: screensTable.userId,
      code: screensTable.code,
      location: screensTable.location,
      status: screensTable.status,
      lastSeen: screensTable.lastSeen,
      defaultPlaylistId: screensTable.defaultPlaylistId,
      resolution: screensTable.resolution,
      panelWidth: screensTable.panelWidth,
      panelHeight: screensTable.panelHeight,
      panelRotation: screensTable.panelRotation,
      tags: screensTable.tags,
      lastScreenshot: screensTable.lastScreenshot,
      powerOnTime: screensTable.powerOnTime,
      powerOffTime: screensTable.powerOffTime,
      powerScheduleJson: screensTable.powerScheduleJson,
      cnpj: screensTable.cnpj,
      companyName: screensTable.companyName,
      createdAt: screensTable.createdAt,
    })
    .from(screensTable)
    .where(whereClause)
    .orderBy(screensTable.createdAt);

  const TWO_MINUTES = 2 * 60 * 1000;
  const nowMs = Date.now();
  const nowDate = new Date();
  const todayStart = new Date(nowDate); todayStart.setHours(0, 0, 0, 0);

  // Batch query: recent plays for ALL screens (no N+1)
  const screenIds = rows.map((r) => r.id);
  const lastPlayByScreen = new Map<number, { mediaName: string; mediaType: string; playedAt: Date }>();
  const playsTodayByScreen = new Map<number, number>();

  if (screenIds.length > 0) {
    const recentPlays = await db.select({
      screenId: mediaPlaysTable.screenId,
      mediaName: mediaPlaysTable.mediaName,
      mediaType: mediaPlaysTable.mediaType,
      playedAt: mediaPlaysTable.playedAt,
    })
      .from(mediaPlaysTable)
      .where(and(inArray(mediaPlaysTable.screenId, screenIds), gte(mediaPlaysTable.playedAt, todayStart)))
      .orderBy(desc(mediaPlaysTable.playedAt))
      .limit(2000);

    for (const p of recentPlays) {
      if (!p.screenId) continue;
      if (!lastPlayByScreen.has(p.screenId)) lastPlayByScreen.set(p.screenId, p as any);
      playsTodayByScreen.set(p.screenId, (playsTodayByScreen.get(p.screenId) ?? 0) + 1);
    }
  }

  // Batch device lookup by screen code (no N+1)
  const screenCodes = rows.map(r => r.code).filter(Boolean);
  const deviceByCode = new Map<string, { serial: string; name: string | null; status: string }>();
  if (screenCodes.length > 0) {
    const linkedDevices = await db.select({
      screenCode: devicesTable.screenCode,
      serial: devicesTable.serial,
      name: devicesTable.name,
      status: devicesTable.status,
    }).from(devicesTable).where(inArray(devicesTable.screenCode, screenCodes));
    for (const d of linkedDevices) {
      if (d.screenCode) deviceByCode.set(d.screenCode, { serial: d.serial, name: d.name ?? null, status: d.status });
    }
  }

  // Batch operator name lookup (admin only)
  const userNameMap = new Map<string, string>();
  if (role === "admin") {
    const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean) as string[])];
    if (userIds.length > 0) {
      const users = await db
        .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds));
      for (const u of users) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
        userNameMap.set(u.id, name);
      }
    }
  }

  const result = await Promise.all(
    rows.map(async (s) => {
      const [activeScheduleRow] = await db
        .select({ playlistName: playlistsTable.name, publishedAt: schedulesTable.createdAt })
        .from(schedulesTable)
        .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
        .where(and(eq(schedulesTable.screenId, s.id), eq(schedulesTable.active, true)))
        .limit(1);

      let defaultPlaylistName: string | null = null;
      if (s.defaultPlaylistId) {
        const [pl] = await db
          .select({ name: playlistsTable.name })
          .from(playlistsTable)
          .where(eq(playlistsTable.id, s.defaultPlaylistId));
        defaultPlaylistName = pl?.name ?? null;
      }

      const computedStatus = s.lastSeen
        ? (nowMs - s.lastSeen.getTime() < TWO_MINUTES ? "online" : "offline")
        : "unknown";

      const lp = lastPlayByScreen.get(s.id);

      return {
        ...s,
        status: computedStatus,
        clientName: role === "admin" ? (userNameMap.get(s.userId ?? "") ?? null) : null,
        activePlaylistName: activeScheduleRow?.playlistName ?? null,
        playlistPublishedAt: activeScheduleRow?.publishedAt?.toISOString() ?? null,
        defaultPlaylistName,
        resolution: s.resolution ?? null,
        tags: s.tags ?? null,
        lastScreenshot: s.lastScreenshot ?? null,
        lastSeen: s.lastSeen?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        lastPlay: lp ? { mediaName: lp.mediaName, mediaType: lp.mediaType, playedAt: lp.playedAt.toISOString() } : null,
        playsToday: playsTodayByScreen.get(s.id) ?? 0,
        device: deviceByCode.get(s.code) ?? null,
      };
    })
  );

  res.json(result);
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const callerUserId = String((req.user as any).id);
  const role = (req.user as any).role;
  const isAdmin = role === "admin";
  const { name, location, timezone, powerOnTime, powerOffTime, panelWidth, panelHeight, assignedUserId, cnpj } = req.body as {
    name: string; location?: string; timezone?: string;
    powerOnTime?: string | null; powerOffTime?: string | null;
    panelWidth?: number | null; panelHeight?: number | null;
    assignedUserId?: string; cnpj?: string | null;
  };
  // Admin can create a screen on behalf of a specific operator
  const userId = (isAdmin && assignedUserId) ? assignedUserId : callerUserId;
  let code = generateCode();
  // Retry until unique
  for (let attempt = 0; attempt < 10; attempt++) {
    const [existing] = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.code, code)).limit(1);
    if (!existing) break;
    code = generateCode();
  }
  const [screen] = await db
    .insert(screensTable)
    .values({
      name, location, code, userId,
      ...(timezone ? { timezone } : {}),
      ...(powerOnTime !== undefined ? { powerOnTime } : {}),
      ...(powerOffTime !== undefined ? { powerOffTime } : {}),
      ...(panelWidth !== undefined ? { panelWidth } : {}),
      ...(panelHeight !== undefined ? { panelHeight } : {}),
      ...(cnpj ? { cnpj } : {}),
    })
    .returning();
  await db.insert(activityTable).values({ userId, action: "created", entityType: "screen", entityName: screen.name, entityId: screen.id, screenId: screen.id });
  res.status(201).json({
    ...screen,
    clientName: null,
    activePlaylistName: null,
    defaultPlaylistName: null,
    lastSeen: null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized", code: "SCREEN_AUTH_REQUIRED" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const { id } = GetScreenParams.parse({ id: Number(req.params.id) });
  const [screen] = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.id, id));

  if (!screen) { res.status(404).json({ error: "Not found" }); return; }
  if (role !== "admin" && screen.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }

  const [activeScheduleRow] = await db
    .select({ playlistName: playlistsTable.name })
    .from(schedulesTable)
    .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
    .where(and(eq(schedulesTable.screenId, id), eq(schedulesTable.active, true)))
    .limit(1);

  let defaultPlaylistName: string | null = null;
  if (screen.defaultPlaylistId) {
    const [pl] = await db
      .select({ name: playlistsTable.name })
      .from(playlistsTable)
      .where(eq(playlistsTable.id, screen.defaultPlaylistId));
    defaultPlaylistName = pl?.name ?? null;
  }

  res.json({
    ...screen,
    clientName: null,
    activePlaylistName: activeScheduleRow?.playlistName ?? null,
    defaultPlaylistName,
    lastSeen: screen.lastSeen?.toISOString() ?? null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = UpdateScreenParams.parse({ id: Number(req.params.id) });
  const body = UpdateScreenBody.parse(req.body);
  const role = (req.user as any).role;
  const userId = String((req.user as any).id);
  // Operators can only update their own screens
  if (role !== "admin") {
    const [existing] = await db.select({ userId: screensTable.userId }).from(screensTable).where(eq(screensTable.id, id));
    if (!existing || existing.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }
  }
  const [screen] = await db.update(screensTable).set(body).where(eq(screensTable.id, id)).returning();
  if (!screen) { res.status(404).json({ error: "Not found" }); return; }
  const uid = req.isAuthenticated() ? String((req.user as any).id) : undefined;
  await db.insert(activityTable).values({ userId: uid, action: "updated", entityType: "screen", entityName: screen.name, entityId: screen.id, screenId: screen.id });

  // Sincroniza nome no dispositivo vinculado
  if (body.name !== undefined) {
    await db.update(devicesTable)
      .set({ name: body.name })
      .where(eq(devicesTable.screenCode, screen.code));
  }

  let defaultPlaylistName: string | null = null;
  if (screen.defaultPlaylistId) {
    const [pl] = await db
      .select({ name: playlistsTable.name })
      .from(playlistsTable)
      .where(eq(playlistsTable.id, screen.defaultPlaylistId));
    defaultPlaylistName = pl?.name ?? null;
  }

  res.json({
    ...screen,
    clientName: null,
    activePlaylistName: null,
    defaultPlaylistName,
    lastSeen: screen.lastSeen?.toISOString() ?? null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = DeleteScreenParams.parse({ id: Number(req.params.id) });
  const role = (req.user as any).role;
  const userId = String((req.user as any).id);

  // Find the screen first to check ownership
  const existing = await db.select().from(screensTable).where(eq(screensTable.id, id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  // Operadores podem excluir suas próprias telas; admins podem excluir qualquer uma
  if (role !== "admin") {
    const screen = existing[0];
    if (screen.userId !== userId) {
      res.status(403).json({ error: "Sem permissão para excluir esta tela" }); return;
    }
  }

  const [screen] = await db.delete(screensTable).where(eq(screensTable.id, id)).returning();
  await db.insert(activityTable).values({ userId, action: "deleted", entityType: "screen", entityName: screen.name, entityId: id, screenId: id });
  // Volta dispositivo vinculado para "pending" e limpa screenCode
  // Sem isso, o /check/:serial recriaria a tela automaticamente ao próximo heartbeat
  await db.update(devicesTable)
    .set({ screenCode: null, status: "pending" })
    .where(eq(devicesTable.screenCode, screen.code));
  res.status(204).send();
});

// ── Brightness Schedules ──────────────────────────────────────────────────────
const BRIGHTNESS_PRESETS: Record<string, Array<{ startTime: string; endTime: string; brightness: number; label: string }>> = {
  vnox:      [{ startTime: "06:00", endTime: "18:00", brightness: 70, label: "Dia" }, { startTime: "18:00", endTime: "06:00", brightness: 35, label: "Noite" }],
  sol:       [{ startTime: "06:00", endTime: "12:00", brightness: 60, label: "Manhã" }, { startTime: "12:00", endTime: "18:00", brightness: 80, label: "Tarde" }, { startTime: "18:00", endTime: "22:00", brightness: 40, label: "Noite" }, { startTime: "22:00", endTime: "06:00", brightness: 20, label: "Madrugada" }],
  shopping:  [{ startTime: "08:00", endTime: "22:00", brightness: 80, label: "Aberto" }, { startTime: "22:00", endTime: "08:00", brightness: 15, label: "Fechado" }],
  economico: [{ startTime: "06:00", endTime: "18:00", brightness: 60, label: "Dia" }, { startTime: "18:00", endTime: "06:00", brightness: 20, label: "Noite" }],
};

async function bsAuthCheck(req: any, res: any, screenId: number): Promise<boolean> {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role as string;
  const [screen] = await db.select({ id: screensTable.id, userId: screensTable.userId }).from(screensTable).where(eq(screensTable.id, screenId));
  if (!screen) { res.status(404).json({ error: "Not found" }); return false; }
  if (role !== "admin" && screen.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return false; }
  return true;
}

router.get("/:id/brightness-schedules", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!await bsAuthCheck(req, res, id)) return;
  const slots = await db.select().from(brightnessSchedulesTable).where(eq(brightnessSchedulesTable.screenId, id)).orderBy(brightnessSchedulesTable.startTime);
  res.json(slots);
});

router.post("/:id/brightness-schedules", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!await bsAuthCheck(req, res, id)) return;
  const { startTime, endTime, brightness, label, days } = req.body as any;
  if (!startTime || !endTime || typeof brightness !== "number" || brightness < 0 || brightness > 100) {
    res.status(400).json({ error: "startTime, endTime e brightness (0-100) são obrigatórios" }); return;
  }
  const [slot] = await db.insert(brightnessSchedulesTable).values({ screenId: id, startTime, endTime, brightness, label: label || null, days: days || "0,1,2,3,4,5,6" }).returning();
  res.status(201).json(slot);
});

router.delete("/:id/brightness-schedules/:scheduleId", async (req, res) => {
  const id = Number(req.params.id);
  const scheduleId = Number(req.params.scheduleId);
  if (isNaN(id) || isNaN(scheduleId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!await bsAuthCheck(req, res, id)) return;
  await db.delete(brightnessSchedulesTable).where(and(eq(brightnessSchedulesTable.id, scheduleId), eq(brightnessSchedulesTable.screenId, id)));
  res.status(204).send();
});

router.post("/:id/brightness-schedules/preset", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!await bsAuthCheck(req, res, id)) return;
  const { preset } = req.body as { preset?: string };
  const slots = preset ? BRIGHTNESS_PRESETS[preset] : null;
  if (!slots) { res.status(400).json({ error: "Preset inválido" }); return; }
  await db.delete(brightnessSchedulesTable).where(eq(brightnessSchedulesTable.screenId, id));
  const inserted = await db.insert(brightnessSchedulesTable).values(slots.map(s => ({ screenId: id, ...s, days: "0,1,2,3,4,5,6" }))).returning();
  res.json(inserted);
});

// ── Brightness control ────────────────────────────────────────────────────────
router.post("/:id/brightness", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid screen id" }); return; }

  const { brightness } = req.body as { brightness?: unknown };
  const value = Number(brightness);
  if (isNaN(value) || value < 0 || value > 100) {
    res.status(400).json({ error: "brightness must be 0–100" }); return;
  }

  const userId = String((req.user as any).id);
  const role = (req.user as any).role as string;

  const [screen] = await db.select({ id: screensTable.id, userId: screensTable.userId })
    .from(screensTable).where(eq(screensTable.id, id));
  if (!screen) { res.status(404).json({ error: "Not found" }); return; }
  if (role !== "admin" && screen.userId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.update(screensTable).set({ targetBrightness: value }).where(eq(screensTable.id, id));
  res.status(200).json({ brightness: value });
});

export default router;
