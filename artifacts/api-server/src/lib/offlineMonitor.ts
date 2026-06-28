import { db, screensTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const TWO_MIN_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000; // a cada 1 minuto

// Guarda quais telas já foram marcadas como offline para não notificar repetidamente
const offlineNotified = new Set<number>();

async function checkOfflineScreens() {
  try {
    const twoMinutesAgo = new Date(Date.now() - TWO_MIN_MS);

    // Telas que enviaram heartbeat recentemente (ainda online)
    const onlineRows = await db
      .select({ id: screensTable.id })
      .from(screensTable)
      .where(sql`${screensTable.lastSeen} > ${twoMinutesAgo}`);

    const onlineIds = new Set(onlineRows.map((r) => r.id));

    // Telas offline com lastSeen registrado (já conectaram antes)
    const offlineRows = await db
      .select({ id: screensTable.id, name: screensTable.name, code: screensTable.code, lastSeen: screensTable.lastSeen })
      .from(screensTable)
      .where(sql`${screensTable.lastSeen} IS NOT NULL AND ${screensTable.lastSeen} <= ${twoMinutesAgo}`);

    for (const screen of offlineRows) {
      if (!offlineNotified.has(screen.id)) {
        // Tela acabou de ficar offline — notificar
        offlineNotified.add(screen.id);
        const lastSeenMin = screen.lastSeen
          ? Math.round((Date.now() - screen.lastSeen.getTime()) / 60000)
          : null;

        logger.warn({
          screenId: screen.id,
          screenName: screen.name,
          screenCode: screen.code,
          lastSeenMinutesAgo: lastSeenMin,
        }, `ALERTA: Tela offline — ${screen.name} (${screen.code})`);

        // Chama o handler de notificação (extensível)
        await notifyOffline(screen).catch((err) =>
          logger.error({ err }, "Erro ao enviar notificação offline")
        );
      }
    }

    // Remove do set telas que voltaram online
    for (const id of offlineNotified) {
      if (onlineIds.has(id)) {
        offlineNotified.delete(id);
        const row = onlineRows.find((r) => r.id === id);
        logger.info({ screenId: id }, `Tela voltou online: id=${id}`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Erro no monitor de telas offline");
  }
}

// ─── Notificação ─────────────────────────────────────────────────────────────
// Por enquanto loga no servidor. Para adicionar SMS/WhatsApp/e-mail:
// configure as variáveis de ambiente e implemente abaixo.

async function notifyOffline(screen: { id: number; name: string; code: string; lastSeen: Date | null }) {
  const lastSeenStr = screen.lastSeen
    ? screen.lastSeen.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "nunca";

  const msg = `⚠️ RPShow Signage-on — Tela OFFLINE!\nNome: ${screen.name}\nCódigo: ${screen.code}\nÚltimo sinal: ${lastSeenStr}`;

  // ── WhatsApp via Callmebot (gratuito) ─────────────────────────────────────
  const waPhone = process.env.WHATSAPP_PHONE;
  const waApiKey = process.env.WHATSAPP_API_KEY;
  if (waPhone && waApiKey) {
    const encoded = encodeURIComponent(msg);
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${waPhone}&text=${encoded}&apikey=${waApiKey}`);
    logger.info({ screenId: screen.id }, "Notificação WhatsApp enviada");
    return;
  }

  // ── Telegram ─────────────────────────────────────────────────────────────
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChatId) {
    const text = `⚠️ *RPShow Signage-on* — Tela offline\\!\n\n*Nome:* ${screen.name}\n*Código:* \`${screen.code}\`\n*Último sinal:* ${lastSeenStr}`;
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChatId, text, parse_mode: "Markdown" }),
    });
    logger.info({ screenId: screen.id }, "Notificação Telegram enviada");
    return;
  }

  // ── Webhook genérico (fallback) ───────────────────────────────────────────
  const webhookUrl = process.env.OFFLINE_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: msg,
      screenId: screen.id,
      screenName: screen.name,
      screenCode: screen.code,
    }),
  });
}

export function startOfflineMonitor() {
  logger.info("Monitor de telas offline iniciado (verificação a cada 60s)");
  setInterval(checkOfflineScreens, CHECK_INTERVAL_MS);
  // Roda imediatamente também
  checkOfflineScreens();
}
