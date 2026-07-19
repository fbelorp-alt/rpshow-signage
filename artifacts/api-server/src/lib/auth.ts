import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
// Renew session if less than half the TTL remains
const SESSION_RENEW_THRESHOLD = SESSION_TTL / 2;

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface SessionData {
  user: AuthUser;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  // Rolling session: extend expire if less than half TTL remains
  const remaining = row.expire.getTime() - Date.now();
  if (remaining < SESSION_RENEW_THRESHOLD) {
    const newExpire = new Date(Date.now() + SESSION_TTL);
    await db
      .update(sessionsTable)
      .set({ expire: newExpire })
      .where(eq(sessionsTable.sid, sid));
  }

  return row.sess as unknown as SessionData;
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}

export async function deleteSessionsForUser(userId: string): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM sessions
    WHERE sess::jsonb->'user'->>'id' = ${userId}
  `);
  return (result as any)?.rowCount ?? 0;
}
