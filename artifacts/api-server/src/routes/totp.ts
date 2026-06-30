import { Router } from "express";
import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import { db, operatorsTable, trustedDevicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createSession, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";

const router = Router();

const APP_NAME = "RPShow OnSign";
const DEVICE_COOKIE = "rpshow_device";
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const TOTP_OPTS = { algorithm: "sha1" as const, digits: 6, period: 30 };

// ── Pending logins store (in-memory, 5-min TTL) ────────────────────────────────
interface PendingLogin {
  operatorId: number;
  expiresAt: number;
}
const pendingLogins = new Map<string, PendingLogin>();

function cleanPending() {
  const now = Date.now();
  for (const [k, v] of pendingLogins) {
    if (now > v.expiresAt) pendingLogins.delete(k);
  }
}

export function createPendingLogin(operatorId: number): string {
  cleanPending();
  const token = crypto.randomBytes(32).toString("hex");
  pendingLogins.set(token, { operatorId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return token;
}

export function consumePendingLogin(token: string): number | null {
  cleanPending();
  const entry = pendingLogins.get(token);
  if (!entry || Date.now() > entry.expiresAt) return null;
  pendingLogins.delete(token);
  return entry.operatorId;
}

// ── Trusted device helpers ─────────────────────────────────────────────────────
export async function isDeviceTrusted(req: any, operatorId: number): Promise<boolean> {
  const token = req.cookies?.[DEVICE_COOKIE];
  if (!token) return false;
  const [device] = await db.select({ id: trustedDevicesTable.id })
    .from(trustedDevicesTable)
    .where(and(
      eq(trustedDevicesTable.token, token),
      eq(trustedDevicesTable.operatorId, operatorId),
    ))
    .limit(1);
  return !!device;
}

export function setDeviceCookie(res: any, token: string) {
  res.cookie(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_TTL_MS,
  });
}

function verifyTotpCode(code: string, secret: string): boolean {
  const result = verifySync({ token: code, secret, ...TOTP_OPTS });
  return result.valid;
}

// ── Setup TOTP (generate secret + QR) — requires auth ─────────────────────────
router.post("/setup", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const operatorId = Number(req.user!.id);

  const secret = generateSecret();
  const [op] = await db.select({ username: operatorsTable.username })
    .from(operatorsTable).where(eq(operatorsTable.id, operatorId)).limit(1);

  const otpauth = generateURI({ issuer: APP_NAME, label: op?.username ?? "user", secret, ...TOTP_OPTS });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  // Store secret temporarily (not enabled yet — waiting for first verify)
  await db.update(operatorsTable).set({ totpSecret: secret }).where(eq(operatorsTable.id, operatorId));

  res.json({ secret, qrDataUrl });
});

// ── Enable TOTP (confirm first code) — requires auth ─────────────────────────
router.post("/enable", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const operatorId = Number(req.user!.id);
  const { code } = req.body as { code?: string };

  if (!code) { res.status(400).json({ error: "Código obrigatório" }); return; }

  const [op] = await db.select({ totpSecret: operatorsTable.totpSecret })
    .from(operatorsTable).where(eq(operatorsTable.id, operatorId)).limit(1);

  if (!op?.totpSecret) { res.status(400).json({ error: "Gere o QR Code primeiro" }); return; }

  if (!verifyTotpCode(code, op.totpSecret)) {
    res.status(400).json({ error: "Código inválido. Tente novamente." });
    return;
  }

  await db.update(operatorsTable).set({ totpEnabled: true }).where(eq(operatorsTable.id, operatorId));
  res.json({ ok: true });
});

// ── Disable TOTP — requires auth + valid code ─────────────────────────────────
router.post("/disable", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const operatorId = Number(req.user!.id);
  const { code } = req.body as { code?: string };

  if (!code) { res.status(400).json({ error: "Código obrigatório" }); return; }

  const [op] = await db.select({
    totpSecret: operatorsTable.totpSecret,
    totpEnabled: operatorsTable.totpEnabled,
  }).from(operatorsTable).where(eq(operatorsTable.id, operatorId)).limit(1);

  if (!op?.totpEnabled || !op.totpSecret) {
    res.status(400).json({ error: "2FA não está ativado" });
    return;
  }

  if (!verifyTotpCode(code, op.totpSecret)) {
    res.status(400).json({ error: "Código inválido." });
    return;
  }

  await db.update(operatorsTable).set({ totpEnabled: false, totpSecret: null }).where(eq(operatorsTable.id, operatorId));
  // Remove all trusted devices for this user
  await db.delete(trustedDevicesTable).where(eq(trustedDevicesTable.operatorId, operatorId));
  res.json({ ok: true });
});

// ── Verify TOTP during login (step 2 after password) ─────────────────────────
router.post("/verify", async (req, res) => {
  const { tempToken, code, rememberDevice } = req.body as {
    tempToken?: string;
    code?: string;
    rememberDevice?: boolean;
  };

  if (!tempToken || !code) { res.status(400).json({ error: "Dados incompletos" }); return; }

  const operatorId = consumePendingLogin(tempToken);
  if (!operatorId) {
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    return;
  }

  const [op] = await db.select().from(operatorsTable).where(eq(operatorsTable.id, operatorId)).limit(1);
  if (!op?.totpSecret) { res.status(401).json({ error: "Configuração inválida" }); return; }

  if (!verifyTotpCode(code, op.totpSecret)) {
    // Re-issue temp token so user can retry without re-entering password
    const newTemp = createPendingLogin(operatorId);
    res.status(401).json({ error: "Código inválido. Tente novamente.", tempToken: newTemp });
    return;
  }

  // Trust device if requested
  if (rememberDevice) {
    const deviceToken = crypto.randomBytes(32).toString("hex");
    const deviceName = (req.headers["user-agent"] ?? "").slice(0, 200);
    const expiresAt = new Date(Date.now() + DEVICE_TTL_MS);
    await db.insert(trustedDevicesTable).values({ operatorId, token: deviceToken, deviceName, expiresAt });
    setDeviceCookie(res, deviceToken);
  }

  // Create full session
  const user = { id: String(op.id), username: op.username, name: op.name, role: op.role };
  const sid = await createSession({ user });
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  res.json({ ok: true, user });
});

// ── Get TOTP status — requires auth ───────────────────────────────────────────
router.get("/status", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const operatorId = Number(req.user!.id);
  const [op] = await db.select({ totpEnabled: operatorsTable.totpEnabled })
    .from(operatorsTable).where(eq(operatorsTable.id, operatorId)).limit(1);
  res.json({ totpEnabled: op?.totpEnabled ?? false });
});

// ── List trusted devices — requires auth ──────────────────────────────────────
router.get("/devices", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const operatorId = Number(req.user!.id);
  const devices = await db.select({
    id: trustedDevicesTable.id,
    deviceName: trustedDevicesTable.deviceName,
    createdAt: trustedDevicesTable.createdAt,
    expiresAt: trustedDevicesTable.expiresAt,
  }).from(trustedDevicesTable)
    .where(eq(trustedDevicesTable.operatorId, operatorId));
  res.json(devices);
});

// ── Remove a trusted device — requires auth ───────────────────────────────────
router.delete("/devices/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const operatorId = Number(req.user!.id);
  const id = parseInt(req.params.id);
  await db.delete(trustedDevicesTable)
    .where(and(eq(trustedDevicesTable.id, id), eq(trustedDevicesTable.operatorId, operatorId)));
  res.status(204).send();
});

export default router;
