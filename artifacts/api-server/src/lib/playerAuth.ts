import { timingSafeEqual, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { screensTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type AuthedScreen = { id: number; code: string; userId: string | null };

/**
 * Validates the X-Device-Token (or Authorization: Bearer) header against the
 * device_token stored in the DB for the given screenCode.
 *
 * Legacy / provisioning path: if the screen has no token yet, we generate one
 * and save it, then accept the request. The player will receive the token in
 * the heartbeat response body (field `deviceToken`) and persist it.
 *
 * Returns the screen on success, or sends 401 and returns null on failure.
 */
export async function assertPlayerAuth(
  req: Request,
  res: Response,
  screenCode: string,
): Promise<AuthedScreen | null> {
  const header = req.headers["x-device-token"] as string | undefined;
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = header || bearer;

  const [screen] = await db
    .select({ id: screensTable.id, code: screensTable.code, userId: screensTable.userId, deviceToken: screensTable.deviceToken })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode))
    .limit(1);

  if (!screen) {
    res.status(404).json({ error: "Tela não encontrada" });
    return null;
  }

  // ── Legacy / provisioning: screen has no token yet ──────────────────────────
  // Accept the request unconditionally and generate a stable token so the player
  // can persist it and authenticate normally from the next request onwards.
  if (!screen.deviceToken) {
    const newToken = randomBytes(32).toString("hex");
    try {
      await db.execute(sql`UPDATE screens SET device_token = ${newToken} WHERE id = ${screen.id}`);
    } catch { /* non-fatal — next heartbeat will try again */ }
    // Attach to res.locals so the route handler can echo it back to the player
    res.locals.provisionedToken = newToken;
    return { id: screen.id, code: screen.code, userId: screen.userId };
  }

  // ── Normal path: token required ──────────────────────────────────────────────
  if (!token) {
    res.status(401).json({ error: "Device token obrigatório" });
    return null;
  }

  try {
    const exp = Buffer.from(screen.deviceToken);
    const prv = Buffer.from(token);
    if (exp.length !== prv.length || !timingSafeEqual(exp, prv)) {
      res.status(401).json({ error: "Token inválido" });
      return null;
    }
  } catch {
    res.status(401).json({ error: "Token inválido" });
    return null;
  }

  return { id: screen.id, code: screen.code, userId: screen.userId };
}

/**
 * Validates that the request carries a device token that matches any screen.
 * Used for endpoints without a specific screenCode (e.g. storage objects).
 * Also accepts a ?token= query param for use in <Video> src / image src URLs.
 */
export async function assertAnyPlayerToken(
  req: Request,
  res: Response,
): Promise<boolean> {
  const headerToken = req.headers["x-device-token"] as string | undefined;
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const queryToken = req.query["token"] as string | undefined;
  const token = headerToken || bearer || queryToken;

  if (!token) {
    res.status(401).json({ error: "Não autorizado" });
    return false;
  }

  const [screen] = await db
    .select({ id: screensTable.id })
    .from(screensTable)
    .where(eq(screensTable.deviceToken, token))
    .limit(1);

  if (!screen) {
    res.status(401).json({ error: "Token inválido" });
    return false;
  }

  return true;
}
