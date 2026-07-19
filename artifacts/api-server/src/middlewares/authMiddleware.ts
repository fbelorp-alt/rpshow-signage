import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "../lib/auth";
import { clearSession, getSessionId, getSession, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = session.user;

  // ── Account gate (skip for admin) ────────────────────────────────────────
  if (session.user.role !== "admin") {
    try {
      const result = await db.execute(sql`
        SELECT blocked, subscription_status
        FROM operators
        WHERE id = ${Number(session.user.id)}
        LIMIT 1
      `);
      const rows = (result as any).rows ?? result;
      const op = Array.isArray(rows) ? rows[0] : undefined;
      if (op) {
        if (op.blocked === true || op.blocked === "true" || op.blocked === 1) {
          res.status(403).json({ error: "Conta bloqueada" });
          return;
        }
        const status = op.subscription_status as string | null | undefined;
        const isBlocked = req.path !== "/auth/logout" && req.path !== "/auth/me"
          && (status === "pending_approval" || status === "suspended");
        if (isBlocked) {
          res.status(403).json({ error: "Conta aguardando aprovação" });
          return;
        }
      }
    } catch (err: unknown) {
      // Column not yet migrated — let request through
      (req as any).log?.warn?.({ err }, "authMiddleware: account gate query failed");
    }
  }

  // Renew the browser cookie so it never expires while the user is active
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  next();
}
