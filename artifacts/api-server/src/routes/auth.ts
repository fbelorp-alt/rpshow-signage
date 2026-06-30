import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { db, operatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type AuthUser,
} from "../lib/auth";

const router = Router();

// ── Rate limiting (in-memory) ─────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_ATTEMPTS) return true;
  entry.count++;
  return false;
}

function resetAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// ── Turnstile verification ────────────────────────────────────────────────────
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // If no secret configured, skip verification in dev
  if (!secret) return true;
  // Dev test secret always passes
  if (secret === "1x0000000000000000000000000000000AA") return true;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// ── Session cookie helper ─────────────────────────────────────────────────────
function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

// ── Setup: create first admin (only if no operators exist) ────────────────────
router.post("/auth/setup", async (req: Request, res: Response) => {
  const count = await db.$count(operatorsTable);
  if (count > 0) {
    res.status(409).json({ error: "Setup already complete" });
    return;
  }
  const { username, password, name } = req.body as { username?: string; password?: string; name?: string };
  if (!username || !password || !name) {
    res.status(400).json({ error: "username, password e name são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [op] = await db.insert(operatorsTable).values({ username, passwordHash, name, role: "admin" }).returning();
  res.status(201).json({ id: op.id, username: op.username, name: op.name, role: op.role });
});

// ── Current user ──────────────────────────────────────────────────────────────
router.get("/auth/user", async (req: Request, res: Response) => {
  const count = await db.$count(operatorsTable);
  if (!req.user) {
    res.json({ user: null, setupRequired: count === 0 });
    return;
  }
  const [op] = await db.select().from(operatorsTable).where(eq(operatorsTable.id, Number(req.user.id))).limit(1);
  const user = op ? {
    ...req.user,
    onboardingDone: op.onboardingDone,
    segment: op.segment,
    jobRole: op.jobRole,
    screenCount: op.screenCount,
  } : req.user;
  res.json({ user, setupRequired: count === 0 });
});

// ── Onboarding ────────────────────────────────────────────────────────────────
router.patch("/auth/onboarding", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }
  const { segment, jobRole, screenCount } = req.body as { segment?: string; jobRole?: string; screenCount?: string };
  await db.update(operatorsTable)
    .set({ segment: segment ?? null, jobRole: jobRole ?? null, screenCount: screenCount ?? null, onboardingDone: true })
    .where(eq(operatorsTable.id, Number(req.user!.id)));
  res.json({ ok: true });
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();

  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Muitas tentativas. Tente novamente em 15 minutos." });
    return;
  }

  const { username, password, cfToken } = req.body as {
    username?: string;
    password?: string;
    cfToken?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    return;
  }

  // Verify Turnstile token
  const captchaOk = await verifyTurnstile(cfToken ?? "", ip);
  if (!captchaOk) {
    res.status(400).json({ error: "Verificação de segurança falhou. Tente novamente." });
    return;
  }

  const [op] = await db.select().from(operatorsTable).where(eq(operatorsTable.username, username.trim())).limit(1);

  if (!op || !(await bcrypt.compare(password, op.passwordHash))) {
    res.status(401).json({ error: "Usuário ou senha incorretos" });
    return;
  }

  resetAttempts(ip);

  const user: AuthUser = {
    id: String(op.id),
    username: op.username,
    name: op.name,
    role: op.role,
  };

  const sid = await createSession({ user });
  setSessionCookie(res, sid);
  res.json({ user });
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

// Legacy GET logout (redirect)
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/login");
});

// Mobile auth (keep for player app compatibility)
router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json({ success: true });
});

// Mobile token exchange (kept for player)
router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Credenciais inválidas" });
    return;
  }
  const [op] = await db.select().from(operatorsTable).where(eq(operatorsTable.username, username.trim())).limit(1);
  if (!op || !(await bcrypt.compare(password, op.passwordHash))) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  const user: AuthUser = { id: String(op.id), username: op.username, name: op.name, role: op.role };
  const token = await createSession({ user });
  res.json({ token });
});

export default router;
