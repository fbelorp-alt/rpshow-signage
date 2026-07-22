import { timingSafeEqual, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { screensTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type AuthedScreen = { id: number; code: string; userId: string | null };

/**
 * Valida o heartbeat/play do player.
 *
 * Regra:
 *  - Se NÃO vier X-Device-Token → aceitar sempre (legacy / TV sem token).
 *    Se a tela não tiver device_token, gerar e salvar agora; devolver em res.locals.provisionedToken.
 *  - Se VIER X-Device-Token → validar contra o banco (comportamento original).
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

  // ── Sem token: modo legado / player antigo ────────────────────────────────
  // Aceitar incondicionalmente; sempre devolver o token (existente ou novo)
  // para o player persistir e usá-lo nas URLs de mídia (?token=).
  if (!token) {
    const rows = await db
      .select({ id: screensTable.id, code: screensTable.code, userId: screensTable.userId, deviceToken: screensTable.deviceToken })
      .from(screensTable)
      .where(eq(screensTable.code, screenCode))
      .limit(1);
    const screen = rows[0];
    if (!screen) {
      res.status(404).json({ error: "Tela não encontrada" });
      return null;
    }
    if (!screen.deviceToken) {
      // Provisiona token novo
      const newToken = randomBytes(32).toString("hex");
      db.execute(sql`UPDATE screens SET device_token = ${newToken} WHERE id = ${screen.id}`).catch(() => {});
      res.locals.provisionedToken = newToken;
    } else {
      // Devolve o token existente para o player persistir e carregar mídias
      res.locals.provisionedToken = screen.deviceToken;
    }
    return { id: screen.id, code: screen.code, userId: screen.userId };
  }

  // ── Com token: validação normal ───────────────────────────────────────────
  const rows = await db
    .select({ id: screensTable.id, code: screensTable.code, userId: screensTable.userId, deviceToken: screensTable.deviceToken })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode))
    .limit(1);
  const screen = rows[0];

  if (!screen?.deviceToken) {
    // Tela sem token no banco: aceitar e provisionar
    const newToken = randomBytes(32).toString("hex");
    db.execute(sql`UPDATE screens SET device_token = ${newToken} WHERE id = ${screen?.id}`).catch(() => {});
    if (screen) res.locals.provisionedToken = newToken;
    if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return null; }
    return { id: screen.id, code: screen.code, userId: screen.userId };
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
