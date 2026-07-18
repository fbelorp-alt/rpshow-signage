import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { db, operatorsTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, sql } from "drizzle-orm";
import { createPendingLogin, isDeviceTrusted, setDeviceCookie } from "./totp";
import { sendPasswordResetEmail } from "../lib/email";
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

/** Login sem SELECT * — evita quebrar quando faltam colunas novas (storage_quota_gb etc). */
type LoginOp = {
  id: number;
  username: string;
  passwordHash: string | null;
  name: string;
  role: string;
  blocked: boolean;
  totpEnabled: boolean;
};

async function findOperatorForLogin(username: string): Promise<LoginOp | null> {
  // Só colunas antigas que existem desde o início do sistema
  const result = await db.execute(sql`
    SELECT id, username, password_hash, name, role
    FROM operators
    WHERE username = ${username.trim()}
    LIMIT 1
  `);
  const rows = (result as any).rows ?? (result as any);
  const r = Array.isArray(rows) ? rows[0] : undefined;
  if (!r) return null;

  // blocked / totp_enabled: tenta ler se a coluna existir; senão assume false
  let blocked = false;
  let totpEnabled = false;
  try {
    const extra = await db.execute(sql`
      SELECT
        COALESCE(blocked, false) AS blocked,
        COALESCE(totp_enabled, false) AS totp_enabled
      FROM operators
      WHERE id = ${Number(r.id)}
      LIMIT 1
    `);
    const erows = (extra as any).rows ?? (extra as any);
    const e = Array.isArray(erows) ? erows[0] : undefined;
    if (e) {
      blocked = Boolean(e.blocked);
      totpEnabled = Boolean(e.totp_enabled);
    }
  } catch {
    // colunas ainda não migradas — login segue sem TOTP/blocked
  }

  return {
    id: Number(r.id),
    username: String(r.username),
    passwordHash: (r.password_hash as string | null) ?? null,
    name: String(r.name),
    role: String(r.role),
    blocked,
    totpEnabled,
  };
}

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

// ── Google OAuth helper ───────────────────────────────────────────────────────
function getGoogleCallbackUrl(req: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}/api/auth/google/callback`;
}

// GET /api/auth/google — inicia fluxo OAuth
router.get("/auth/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.redirect("/login?error=google_not_configured");
    return;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleCallbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback — retorno do Google
router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };
  if (error || !code) {
    res.redirect("/login?error=google_denied");
    return;
  }

  try {
    const callbackUrl = getGoogleCallbackUrl(req);

    // Troca code por access_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokens.access_token) {
      res.redirect("/login?error=google_token_failed");
      return;
    }

    // Busca dados do usuário Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json() as { sub: string; email?: string; name?: string };
    if (!googleUser.sub) {
      res.redirect("/login?error=google_userinfo_failed");
      return;
    }

    // 1. Busca por googleId
    let [operator] = await db
      .select()
      .from(operatorsTable)
      .where(eq(operatorsTable.googleId, googleUser.sub))
      .limit(1);

    // 2. Vincula por e-mail se não achou pelo ID
    if (!operator && googleUser.email) {
      const [byEmail] = await db
        .select()
        .from(operatorsTable)
        .where(eq(operatorsTable.email, googleUser.email))
        .limit(1);
      if (byEmail) {
        await db.update(operatorsTable).set({ googleId: googleUser.sub }).where(eq(operatorsTable.id, byEmail.id));
        operator = { ...byEmail, googleId: googleUser.sub };
      }
    }

    // 3. Cria novo operador (trial 30 dias)
    if (!operator) {
      const baseUsername = (googleUser.email?.split("@")[0] ?? "user").replace(/[^a-z0-9._-]/gi, "").slice(0, 20);
      const username = `${baseUsername}_g${googleUser.sub.slice(-6)}`;
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      [operator] = await db
        .insert(operatorsTable)
        .values({
          username,
          passwordHash: null,
          name: googleUser.name ?? googleUser.email ?? username,
          email: googleUser.email ?? null,
          googleId: googleUser.sub,
          role: "operator",
          subscriptionStatus: "trial",
          trialDays: 30,
          trialEndsAt,
        })
        .returning();
    }

    if (operator.blocked) {
      res.redirect("/login?error=account_blocked");
      return;
    }

    const sid = await createSession({
      user: { id: String(operator.id), username: operator.username, name: operator.name, role: operator.role },
    });
    setSessionCookie(res, sid);
    res.redirect("/");
  } catch (err) {
    req.log.error(err, "Google OAuth callback error");
    res.redirect("/login?error=google_error");
  }
});

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

// ── Self-registration ─────────────────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  const { username, password, name, email, phone } = req.body as {
    username?: string;
    password?: string;
    name?: string;
    email?: string;
    phone?: string;
  };

  if (!username || !password || !name || !email) {
    res.status(400).json({ error: "Nome, usuário, e-mail e senha são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }

  const existing = await db
    .select()
    .from(operatorsTable)
    .where(eq(operatorsTable.username, username.trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Este nome de usuário já está em uso" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [op] = await db
    .insert(operatorsTable)
    .values({
      username: username.trim(),
      passwordHash,
      name,
      email: email ?? null,
      phone: phone ?? null,
      role: "operator",
      subscriptionStatus: "pending_approval",
      trialDays: 30,
      trialEndsAt,
    })
    .returning();

  const user: AuthUser = {
    id: String(op!.id),
    username: op!.username,
    name: op!.name,
    role: op!.role,
  };

  const sid = await createSession({ user });
  setSessionCookie(res, sid);
  res.status(201).json({ user });
});

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
    role: op.role,
    name: op.name,
    onboardingDone: op.onboardingDone,
    segment: op.segment,
    jobRole: op.jobRole,
    screenCount: op.screenCount,
    subscriptionStatus: op.subscriptionStatus,
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

// ── Forgot password: request reset link ───────────────────────────────────────
router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  const genericResponse = { ok: true, message: "Se o e-mail estiver cadastrado, enviaremos um link de recuperação." };

  if (!email) {
    res.status(400).json({ error: "E-mail é obrigatório" });
    return;
  }

  const [op] = await db
    .select()
    .from(operatorsTable)
    .where(eq(operatorsTable.email, email.trim().toLowerCase()))
    .limit(1);

  // Always respond generically to avoid leaking which e-mails are registered
  if (!op) {
    res.json(genericResponse);
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await db.insert(passwordResetTokensTable).values({
    operatorId: op.id,
    token,
    expiresAt,
  });

  const origin = req.headers.origin ?? `${req.protocol}://${req.get("host")}`;
  const resetUrl = `${origin}/login?resetToken=${token}`;

  const sent = await sendPasswordResetEmail(op.email!, resetUrl);
  if (!sent) {
    req.log?.error({ operatorId: op.id }, "Falha ao enviar e-mail de recuperação de senha");
  }

  res.json(genericResponse);
});

// ── Reset password with token ─────────────────────────────────────────────────
router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    res.status(400).json({ error: "Token e nova senha são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        eq(passwordResetTokensTable.used, false),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!resetToken) {
    res.status(400).json({ error: "Link inválido ou expirado. Solicite uma nova recuperação de senha." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.update(operatorsTable).set({ passwordHash }).where(eq(operatorsTable.id, resetToken.operatorId));
  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, resetToken.id));

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

  const op = await findOperatorForLogin(username);

  if (!op || !op.passwordHash || !(await bcrypt.compare(password, op.passwordHash))) {
    res.status(401).json({ error: "Usuário ou senha incorretos" });
    return;
  }

  if (op.blocked) {
    res.status(403).json({ error: "Acesso bloqueado. Entre em contato com o administrador." });
    return;
  }

  resetAttempts(ip);

  // If TOTP is enabled, check for trusted device before creating session
  if (op.totpEnabled) {
    const trusted = await isDeviceTrusted(req, op.id);
    if (!trusted) {
      // Return a temp token — frontend will ask for TOTP code
      const tempToken = createPendingLogin(op.id);
      res.json({ requiresTotp: true, tempToken });
      return;
    }
  }

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
  const op = await findOperatorForLogin(username);
  if (!op || !op.passwordHash || !(await bcrypt.compare(password, op.passwordHash))) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  const user: AuthUser = { id: String(op.id), username: op.username, name: op.name, role: op.role };
  const token = await createSession({ user });
  res.json({ token });
});

export default router;
